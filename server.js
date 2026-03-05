// server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
app.use(cors());
app.use(bodyParser.json());

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
    const db = client.db("pycasas");
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
    const db = client.db("pycasas");
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
    const { productos = [], alquileres = [] } = req.body;
    const db = client.db("pycasas");

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
