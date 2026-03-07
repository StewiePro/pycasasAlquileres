// server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(bodyParser.json());

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
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";

// 🔹 Cliente Mongo (una sola instancia)
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// 🔹 Conexión inicial (una sola vez)
async function conectarMongo() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Conectado a MongoDB");
  } catch (err) {
    console.error("❌ Error conectando a MongoDB:", err);
    process.exit(1);
  }
}

// 🔹 Endpoint: estado de conexión Mongo
app.get("/api/health", async (req, res) => {
  try {
    await client.db("admin").command({ ping: 1 });
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
    const db = client.db(dbName);
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
    const db = client.db(dbName);
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
    const db = client.db(dbName);

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
    const db = client.db("pycasas");
    const usuarios = db.collection("usuarios");

    const existente = await usuarios.findOne({ username });
    if (existente) {
      return res.status(400).json({ error: "El nombre de usuario ya está en uso." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);
    const token = crypto.randomBytes(20).toString('hex');

    const nuevoUsuario = {
      nombre,
      email,
      username,
      password: hashPassword,
      role,
      activo: false,
      tokenAprobacion: token,
      fechaRegistro: new Date()
    };

    await usuarios.insertOne(nuevoUsuario);

    const linkApprove = `http://localhost:${PORT}/api/aprobar-usuario?token=${token}`;
    
    const mailOptions = {
      from: '"Gestión PYME" <c.pycasas@gmail.com>',
      to: "tecnico@pycasas.co",
      subject: "Solicitud de Aprobación de Nuevo Usuario",
      text: `Se ha registrado el usuario ${username} (${nombre}) con rol ${role}. Enlace de aprobación: ${linkApprove}`,
      html: `<h3>Aprobación de Nuevo Usuario</h3>
             <p><strong>Nombre:</strong> ${nombre}</p>
             <p><strong>Usuario:</strong> ${username}</p>
             <p><strong>Rol solicitado:</strong> ${role}</p>
             <p>Por favor, haz clic en el siguiente enlace para aprobar y activar a este usuario:</p>
             <a href="${linkApprove}" style="padding: 10px 15px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 5px;">Aprobar Usuario</a>`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("📩 Correo de aprobación enviado.");

    res.json({ ok: true, msg: "Usuario registrado. Esperando aprobación." });
  } catch (err) {
    console.error("❌ Error en registro:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/aprobar-usuario", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.send("Token inválido");

    const db = client.db("pycasas");
    const result = await db.collection("usuarios").updateOne(
      { tokenAprobacion: token },
      { $set: { activo: true }, $unset: { tokenAprobacion: "" } }
    );

    if (result.modifiedCount === 0) {
      return res.send("<h1>Token inválido o usuario ya aprobado.</h1>");
    }

    res.send("<h1>✅ Usuario aprobado exitosamente. Ya puede iniciar sesión.</h1>");
  } catch (err) {
    console.error("❌ Error aprobando usuario:", err);
    res.status(500).send("Error del servidor");
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

    const db = client.db("pycasas");
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
