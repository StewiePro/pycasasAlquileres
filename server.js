// server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔹 URI de conexión a Atlas
const uri = "mongodb+srv://Proyectar2020:Proyectar2012@pycasasalquiler.buitgrz.mongodb.net/?appName=PycasasAlquiler";

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
    console.log("✅ Conectado a MongoDB Atlas");
  } catch (err) {
    console.error("❌ Error conectando a Mongo:", err);
    process.exit(1);
  }
}
conectarMongo();

// 🔹 Endpoint: obtener alquileres
app.get("/api/alquileres", async (req, res) => {
  try {
    const db = client.db("pycasas");
    const alquileres = await db.collection("alquileres").find().toArray();
    res.json(alquileres);
  } catch (err) {
    console.error("❌ Error en /api/alquileres:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Endpoint: obtener productos
app.get("/api/productos", async (req, res) => {
  try {
    const db = client.db("pycasas");
    const productos = await db.collection("productos").find().toArray();
    res.json(productos);
  } catch (err) {
    console.error("❌ Error en /api/productos:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

// 🔹 Definir esquemas
const ProductoSchema = new mongoose.Schema({
  id: Number,
  codigo: String,
  nombre: String,
  stock: Number,
  precio: Number,
});

const AlquilerSchema = new mongoose.Schema({
  id: Number,
  cliente: {
    nombre: String,
    identificacion: String,
    telefono: String,
    direccion: String,
  },
  items: [
    {
      productoId: Number,
      codigo: String,
      nombre: String,
      cantidad: Number,
      precioAlquiler: Number,
    },
  ],
  subtotalDia: Number,
  garantia: Number,
  garantiaCobrada: Boolean,
  totalAlquiler: Number,
  totalPagar: Number,
  estado: String,
  fechaSalida: String,
  fechaDevolucionReal: String,
  observaciones: String,
});

const Producto = mongoose.model("Producto", ProductoSchema);
const Alquiler = mongoose.model("Alquiler", AlquilerSchema);

// 🔹 Endpoint para exportar datos
app.post("/api/exportar", async (req, res) => {
  try {
    const { productos, alquileres } = req.body;

    if (productos?.length) {
      await Producto.deleteMany({});
      await Producto.insertMany(productos);
    }

    if (alquileres?.length) {
      await Alquiler.deleteMany({});
      await Alquiler.insertMany(alquileres);
    }

    res.json({ ok: true, msg: "Datos exportados a MongoDB" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});

app.post("/api/exportar", async (req, res) => {
  try {
    const { productos, alquileres } = req.body;

    const db = client.db("pycasas");

    if (productos?.length) {
      await db.collection("productos").deleteMany({});
      await db.collection("productos").insertMany(productos);
    }

    if (alquileres?.length) {
      await db.collection("alquileres").deleteMany({});
      await db.collection("alquileres").insertMany(alquileres);
    }

    res.json({ ok: true, msg: "Datos exportados a MongoDB Atlas" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/exportar", async (req, res) => {
  try {
    const { productos, alquileres } = req.body;
    const db = client.db("pycasas");

    if (productos?.length) {
      await db.collection("productos").deleteMany({});
      await db.collection("productos").insertMany(productos);
    }

    if (alquileres?.length) {
      await db.collection("alquileres").deleteMany({});
      await db.collection("alquileres").insertMany(alquileres);
    }

    res.json({ ok: true, msg: "Datos exportados a MongoDB Atlas" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/productos", async (req, res) => {
  const db = client.db("pycasas");
  const productos = await db.collection("productos").find().toArray();
  res.json(productos);
});

app.get("/api/alquileres", async (req, res) => {
  const db = client.db("pycasas");
  const alquileres = await db.collection("alquileres").find().toArray();
  res.json(alquileres);
});

async function cargarHistorial() {
  const res = await fetch("http://localhost:3000/api/alquileres");
  const alquileres = await res.json();

  // Aquí actualizas tu tabla con los datos reales de Mongo
  renderTabla(alquileres);
}

app.get("/api/alquileres", async (req, res) => {
  try {
    const db = client.db("pycasas");
    const alquileres = await db.collection("alquileres").find().toArray();
    res.json(alquileres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});