// server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Detectar directorio base para archivos estáticos
// En Vercel usa process.cwd(), en local usa __dirname
const baseDir = process.cwd();

// Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static(baseDir));

// Rutas para archivos HTML específicos
app.get("/:page.html", (req, res) => {
  const page = req.params.page;
  res.sendFile(path.join(baseDir, `${page}.html`));
});

// Ruta raíz
app.get("/", (req, res) => {
  res.sendFile(path.join(baseDir, "index.html"));
});

// 🔹 Configuración de nodemailer con Dreamhost SMTP
let transporter;
async function initMailer() {
  try {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "c.pycasas@gmail.com",
        pass: "rrivumatfjxoorey", 
      },
    });
    console.log("✉️ Nodemailer (SMTP Dreamhost) listo para producción");
  } catch (err) {
    console.error("❌ Error iniciando Nodemailer:", err);
  }
}
initMailer();

// 🔹 URI de conexión: usa variable de entorno o Mongo local (Compass)
// IMPORTANTE: En Vercel debe estar configurada la variable MONGODB_URI
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";

// 🔹 Cliente Mongo - gestionar conexión para Vercel
let client;
let clientPromise;

// Función para obtener el cliente Mongo
async function getMongoClient() {
  // Si no hay cliente, crear uno nuevo
  if (!client) {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
  }
  
  // Verificar si ya está conectado
  try {
    if (client.topology && client.topology.isConnected()) {
      return client;
    }
  } catch (e) {
    // topology puede no existir todavía
  }
  
  // Conectar si no está conectado
  try {
    await client.connect();
  } catch (e) {
    console.error("Error conectando a MongoDB:", e.message);
  }
  
  return client;
}

// 🔹 Conexión inicial (una sola vez)
async function conectarMongo() {
  try {
    const mongoClient = await getMongoClient();
    await mongoClient.db("admin").command({ ping: 1 });
    console.log("✅ Conectado a MongoDB");
  } catch (err) {
    console.error("❌ Error conectando a MongoDB:", err.message);
  }
}

// 🔹 Endpoint: estado de conexión Mongo
app.get("/api/health", async (req, res) => {
  try {
    const mongoClient = await getMongoClient();
    await mongoClient.db("admin").command({ ping: 1 });
    res.json({ ok: true, mongo: "up", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, mongo: "down", error: err.message });
  }
});

// 🔹 Endpoint: obtener productos
app.get("/api/productos", async (req, res) => {
  try {
    const isTest = req.query.test === "true";
    const dbName = isTest ? "pycasas_test" : "pycasas";
    const mongoClient = await getMongoClient();
    const db = mongoClient.db(dbName);
    const productos = await db.collection("productos").find().toArray();
    res.json(productos);
  } catch (err) {
    console.error("❌ Error en /api/productos:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Endpoint: obtener alquileres
app.get("/api/alquileres", async (req, res) => {
  try {
    const isTest = req.query.test === "true";
    const dbName = isTest ? "pycasas_test" : "pycasas";
    const mongoClient = await getMongoClient();
    const db = mongoClient.db(dbName);
    const alquileres = await db.collection("alquileres").find().toArray();
    res.json(alquileres);
  } catch (err) {
    console.error("❌ Error en /api/alquileres:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Endpoint: exportar datos desde el frontend
// Reemplaza completamente colecciones para mantener consistencia con localStorage
app.post("/api/exportar", async (req, res) => {
  try {
    const { productos = [], alquileres = [], isTest = false } = req.body;
    const dbName = isTest ? "pycasas_test" : "pycasas";
    const mongoClient = await getMongoClient();
    const db = mongoClient.db(dbName);

    // Sin transacciones para compatibilidad con Mongo local sin replica set.
    await db.collection("productos").deleteMany({});
    if (Array.isArray(productos) && productos.length > 0) {
      await db.collection("productos").insertMany(productos);
    }

    await db.collection("alquileres").deleteMany({});
    if (Array.isArray(alquileres) && alquileres.length > 0) {
      await db.collection("alquileres").insertMany(alquileres);
    }

    res.json({ ok: true, msg: "Datos exportados a MongoDB Atlas" });
  } catch (err) {
    console.error("❌ Error en /api/exportar:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🔹 Iniciar servidor después de conectar a Mongo
const PORT = process.env.PORT || 3000;
conectarMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
});

// 🔹 Endpoints de Autenticación
app.post("/api/registro", async (req, res) => {
  try {
    const { nombre, email, username, password, role } = req.body;
    const mongoClient = await getMongoClient();
    const db = mongoClient.db("pycasas");
    const usuarios = db.collection("usuarios");

    const existente = await usuarios.findOne({ username });
    if (existente) {
      return res.status(400).json({ error: "El nombre de usuario ya está en uso." });
    }

    // Verificar si el email ya está registrado
    const emailExistente = await usuarios.findOne({ email });
    if (emailExistente) {
      return res.status(400).json({ error: "El correo electrónico ya está registrado." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);
    const tokenAprobacion = crypto.randomBytes(20).toString('hex');
    const tokenRechazo = crypto.randomBytes(20).toString('hex');

    const nuevoUsuario = {
      nombre,
      email,
      username,
      password: hashPassword,
      role,
      activo: false,
      aprobado: false,
      tokenAprobacion: tokenAprobacion,
      tokenRechazo: tokenRechazo,
      fechaRegistro: new Date()
    };

    await usuarios.insertOne(nuevoUsuario);

    const linkApprove = `http://localhost:${PORT}/api/aprobar-usuario?token=${tokenAprobacion}`;
    const linkReject = `http://localhost:${PORT}/api/rechazar-usuario?token=${tokenRechazo}`;
    
    const mailOptions = {
      from: '"Gestión PYME - Solicitud de Usuario" <c.pycasas@gmail.com>',
      to: "tecnico@pycasas.co",
      subject: `🔔 Nueva solicitud de usuario: ${username} - ${role}`,
      text: `Se ha registrado el usuario ${username} (${nombre}) con rol ${role} y correo ${email}.\n\nEnlace de aprobación: ${linkApprove}\nEnlace de rechazo: ${linkReject}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0066cc;">📋 Nueva Solicitud de Usuario</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Nombre:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${nombre}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Usuario:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${username}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Correo:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Rol solicitado:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${role}</td>
          </tr>
          <tr>
            <td style="padding: 10px;"><strong>Fecha de solicitud:</strong></td>
            <td style="padding: 10px;">${new Date().toLocaleString('es-CO')}</td>
          </tr>
        </table>
        <p>Por favor, revisa la solicitud y decide si aprobar o rechazar:</p>
        <div style="margin: 20px 0;">
          <a href="${linkApprove}" style="display: inline-block; padding: 12px 24px; background: #28a745; color: #fff; text-decoration: none; border-radius: 5px; margin-right: 10px;">✅ Aprobar Usuario</a>
          <a href="${linkReject}" style="display: inline-block; padding: 12px 24px; background: #dc3545; color: #fff; text-decoration: none; border-radius: 5px;">❌ Rechazar Usuario</a>
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">Este es un mensaje automático del sistema de Gestión PYME.</p>
      </div>`
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("📩 Correo de aprobación enviado a tecnico@pycasas.co:", info.messageId);
    } catch (emailErr) {
      console.error("❌ Error enviando correo:", emailErr);
      return res.status(500).json({ error: "Error al enviar el correo de notificación." });
    }

    res.json({ ok: true, msg: "Usuario registrado correctamente. Se ha enviado una notificación a tecnico@pycasas.co para aprobar tu cuenta. No podrás iniciar sesión hasta que sea aprobada." });
  } catch (err) {
    console.error("❌ Error en registro:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/aprobar-usuario", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.send("<h1>Token inválido</h1>");

    const mongoClient = await getMongoClient();
    const db = mongoClient.db("pycasas");
    const usuario = await db.collection("usuarios").findOne({ tokenAprobacion: token });
    
    if (!usuario) {
      return res.send("<h1>Token inválido o usuario ya aprobado.</h1>");
    }

    await db.collection("usuarios").updateOne(
      { _id: usuario._id },
      { $set: { activo: true, aprobado: true, fechaAprobacion: new Date() }, $unset: { tokenAprobacion: "", tokenRechazo: "" } }
    );

    // Enviar correo de notificación al usuario aprobado
    const mailOptionsAprobado = {
      from: '"Gestión PYME" <c.pycasas@gmail.com>',
      to: usuario.email,
      subject: "✅ Tu cuenta ha sido aprobada - Gestión PYME",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">🎉 ¡Bienvenido a Gestión PYME!</h2>
        <p>Hola <strong>${usuario.nombre}</strong>,</p>
        <p>Tu cuenta ha sido <strong>aprobada</strong> por el administrador.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <p><strong>Usuario:</strong> ${usuario.username}</p>
          <p><strong>Rol:</strong> ${usuario.role}</p>
        </div>
        <p>Ahora puedes iniciar sesión en el sistema:</p>
        <a href="http://localhost:3000/login.html" style="display: inline-block; padding: 12px 24px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 5px;">Iniciar Sesión</a>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">Este es un mensaje automático del sistema de Gestión PYME.</p>
      </div>`
    };

    try {
      await transporter.sendMail(mailOptionsAprobado);
      console.log("📩 Correo de aprobación enviado al usuario:", usuario.email);
    } catch (emailErr) {
      console.error("❌ Error enviando correo de aprobación al usuario:", emailErr);
    }

    res.send(`<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
      <h1 style="color: #28a745;">✅ Usuario aprobado exitosamente</h1>
      <p>El usuario <strong>${usuario.username}</strong> ha sido aprobado y podrá iniciar sesión.</p>
      <p>Se ha enviado una notificación al correo: ${usuario.email}</p>
      <a href="http://localhost:3000/login.html" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 5px;">Ir al Login</a>
    </div>`);
  } catch (err) {
    console.error("❌ Error aprobando usuario:", err);
    res.status(500).send("Error del servidor");
  }
});

app.get("/api/rechazar-usuario", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.send("<h1>Token inválido</h1>");

    const mongoClient = await getMongoClient();
    const db = mongoClient.db("pycasas");
    const usuario = await db.collection("usuarios").findOne({ tokenRechazo: token });
    
    if (!usuario) {
      return res.send("<h1>Token inválido o usuario ya procesado.</h1>");
    }

    const nombreUsuario = usuario.username;
    const emailUsuario = usuario.email;
    const nombreCompleto = usuario.nombre;

    // Eliminar el usuario rechazado
    await db.collection("usuarios").deleteOne({ _id: usuario._id });

    // Enviar correo de notificación al usuario rechazado
    const mailOptionsRechazado = {
      from: '"Gestión PYME" <c.pycasas@gmail.com>',
      to: emailUsuario,
      subject: "❌ Solicitud de cuenta rechazada - Gestión PYME",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Solicitud de cuenta rechazada</h2>
        <p>Hola <strong>${nombreCompleto}</strong>,</p>
        <p>Lamentamos informarte que tu solicitud de registro en el sistema de Gestión PYME ha sido <strong>rechazada</strong> por el administrador.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <p><strong>Usuario:</strong> ${nombreUsuario}</p>
        </div>
        <p>Si crees que esto es un error, por favor contacta al administrador del sistema.</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">Este es un mensaje automático del sistema de Gestión PYME.</p>
      </div>`
    };

    try {
      await transporter.sendMail(mailOptionsRechazado);
      console.log("📩 Correo de rechazo enviado al usuario:", emailUsuario);
    } catch (emailErr) {
      console.error("❌ Error enviando correo de rechazo al usuario:", emailErr);
    }

    res.send(`<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
      <h1 style="color: #dc3545;">❌ Solicitud rechazada</h1>
      <p>El usuario <strong>${nombreUsuario}</strong> ha sido rechazado y eliminado del sistema.</p>
      <p>Se ha enviado una notificación al correo: ${emailUsuario}</p>
      <a href="http://localhost:3000/login.html" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 5px;">Ir al Login</a>
    </div>`);
  } catch (err) {
    console.error("❌ Error rechazando usuario:", err);
    res.status(500).send("Error del servidor");
  }
});

// Endpoint para ver usuarios pendientes de aprobación (para el técnico)
app.get("/api/usuarios-pendientes", async (req, res) => {
  try {
    const mongoClient = await getMongoClient();
    const db = mongoClient.db("pycasas");
    const usuarios = await db.collection("usuarios").find({ activo: false }).toArray();
    
    // Limpiar tokens antes de enviar
    const usuariosLimpios = usuarios.map(u => ({
      _id: u._id,
      nombre: u.nombre,
      email: u.email,
      username: u.username,
      role: u.role,
      fechaRegistro: u.fechaRegistro
    }));
    
    res.json(usuariosLimpios);
  } catch (err) {
    console.error("❌ Error obteniendo usuarios pendientes:", err);
    res.status(500).json({ error: err.message });
  }
});

// Aprobar usuario por ID
app.post("/api/aprobar-usuario-id/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const mongoClient = await getMongoClient();
    const db = mongoClient.db("pycasas");
    const usuario = await db.collection("usuarios").findOne({ _id: new ObjectId(id) });
    
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    await db.collection("usuarios").updateOne(
      { _id: new ObjectId(id) },
      { $set: { activo: true, aprobado: true, fechaAprobacion: new Date() }, $unset: { tokenAprobacion: "", tokenRechazo: "" } }
    );

    // Enviar correo de notificación al usuario aprobado
    const mailOptionsAprobado = {
      from: '"Gestión PYME" <c.pycasas@gmail.com>',
      to: usuario.email,
      subject: "✅ Tu cuenta ha sido aprobada - Gestión PYME",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">¡Tu cuenta ha sido aprobada!</h2>
        <p>Hola <strong>${usuario.nombre}</strong>,</p>
        <p>Tu cuenta ha sido <strong>aprobada</strong> por el administrador y ahora puedes acceder al sistema.</p>
        <a href="http://localhost:3000/login.html" style="display: inline-block; padding: 12px 24px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 5px;">Iniciar Sesión</a>
      </div>`
    };

    await transporter.sendMail(mailOptionsAprobado);
    res.json({ ok: true, msg: "Usuario aprobado" });
  } catch (err) {
    console.error("❌ Error aprobando usuario:", err);
    res.status(500).json({ error: err.message });
  }
});

// Rechazar usuario por ID
app.post("/api/rechazar-usuario-id/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const mongoClient = await getMongoClient();
    const db = mongoClient.db("pycasas");
    const usuario = await db.collection("usuarios").findOne({ _id: new ObjectId(id) });
    
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const nombreUsuario = usuario.username;
    const emailUsuario = usuario.email;

    // Eliminar el usuario
    await db.collection("usuarios").deleteOne({ _id: new ObjectId(id) });

    // Enviar correo de notificación
    const mailOptionsRechazado = {
      from: '"Gestión PYME" <c.pycasas@gmail.com>',
      to: emailUsuario,
      subject: "❌ Solicitud de cuenta rechazada - Gestión PYME",
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Solicitud rechazada</h2>
        <p>Hola <strong>${usuario.nombre}</strong>,</p>
        <p>Lamentamos informarte que tu solicitud ha sido rechazada.</p>
        <p>Contacta al administrador para más información.</p>
      </div>`
    };

    await transporter.sendMail(mailOptionsRechazado);
    res.json({ ok: true, msg: "Usuario rechazado" });
  } catch (err) {
    console.error("❌ Error rechazando usuario:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    // Primero, revisar si es un usuario temporal (ej. USUARIOS_DEMO/Pruebas) almacenado desde front
    // Para no romper la funcionalidad de la demo de Pruebas:
    if (req.body.isDemoUser) {
      // Dejamos que el frontend lo maneje si es isDemoUser, esto es un fallback vacío
      return res.json({ ok: true }); 
    }

    const mongoClient = await getMongoClient();
    const db = mongoClient.db("pycasas");
    const usuario = await db.collection("usuarios").findOne({ username });

    if (!usuario) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    const isMatch = await bcrypt.compare(password, usuario.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    if (usuario.role !== role) {
      return res.status(401).json({ error: "Rol incorrecto para este usuario" });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: "Tu cuenta aún no ha sido aprobada por tecnico@pycasas.co" });
    }

    res.json({ ok: true, usuario: { username: usuario.username, role: usuario.role, isTest: false } });
  } catch (err) {
    console.error("❌ Error en login:", err);
    res.status(500).json({ error: err.message });
  }
});
