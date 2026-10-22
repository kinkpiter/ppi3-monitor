// ===== IMPORTS =====
import express from "express";
import cors from "cors";
import http from "http";
import si from "systeminformation";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// ===== CONFIGURACION =====
const app = express();
const PUERTO = 3001;

// Servidor HTTP
const servidor = http.createServer(app);

// Servidor WebSocket
const io = new Server(servidor, {
    cors: {
        origin: "*"
    }
});

app.use(cors());
app.use(express.json());
// ===== PUBLICAR FRONTEND =====

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(
    path.join(__dirname, "../frontend")
));
// ===== FUNCIONES AUXILIARES =====

// Convertir bytes a GB
const bytesAGB = (bytes) => {
    return Number((bytes / 1024 ** 3).toFixed(2));
};

// Formatear el tiempo de actividad
const formatearUptime = (segundos) => {
    const dias = Math.floor(segundos / 86400);
    const horas = Math.floor((segundos % 86400) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);

    return `${dias}d ${horas}h ${minutos}m`;
};

// ===== OBTENER INFORMACION DEL SISTEMA =====

const obtenerRecursos = async () => {

    const [
        sistema,
        cpu,
        cargaCPU,
        memoria,
        discos,
        procesos,
        tiempo
    ] = await Promise.all([
        si.osInfo(),
        si.cpu(),
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.processes(),
        si.time()
    ]);

    // Buscar el sistema de archivos raíz
    const discoPrincipal = discos.find(
        disco => disco.mount === "/"
    );

    return {
        hostname: sistema.hostname,
        plataforma: sistema.platform,
        distribucion: sistema.distro,
        kernel: sistema.kernel,
        arquitectura: sistema.arch,

        cpu: {
            fabricante: cpu.manufacturer,
            modelo: cpu.brand,
            nucleos: cpu.cores,
            uso: Number(cargaCPU.currentLoad.toFixed(2))
        },

        ram: {
            total: bytesAGB(memoria.total),
            usada: bytesAGB(memoria.active),
            libre: bytesAGB(memoria.available),
            porcentaje: Number(
                ((memoria.active / memoria.total) * 100).toFixed(2)
            )
        },

        disco: discoPrincipal ? {
            total: bytesAGB(discoPrincipal.size),
            usado: bytesAGB(discoPrincipal.used),
            disponible: bytesAGB(
                discoPrincipal.size - discoPrincipal.used
            ),
            porcentaje: discoPrincipal.use
        } : null,

        procesos: procesos.all,
        uptime: formatearUptime(tiempo.uptime),
        fecha: new Date().toLocaleString("es-AR")
    };
};

// ===== ENDPOINT: SALUD DE LA API =====

app.get("/api/health", (req, res) => {

    res.json({
        status: "ok",
        uptimeApi: formatearUptime(process.uptime())
    });

});

// ===== ENDPOINT: INFORMACION DEL SISTEMA =====

app.get("/api/sysinfo", async (req, res) => {

    try {
        const recursos = await obtenerRecursos();
        res.json(recursos);

    } catch (error) {

        console.error("Error obteniendo recursos:", error);

        res.status(500).json({
            error: "No se pudo obtener informacion del sistema"
        });
    }
});

// ===== SOCKET.IO =====

io.on("connection", (socket) => {

    console.log("Cliente conectado:", socket.id);

    socket.on("disconnect", () => {
        console.log("Cliente desconectado:", socket.id);
    });

});

// ===== ACTUALIZACION EN TIEMPO REAL =====

// Enviar informacion cada 3 segundos
setInterval(async () => {

    try {
        const recursos = await obtenerRecursos();

        io.emit("recursos", recursos);

    } catch (error) {
        console.error("Error al actualizar recursos:", error);
    }

}, 3000);

// ===== INICIAR SERVIDOR =====

servidor.listen(PUERTO, () => {

    console.log(
        `Monitor PPIII funcionando en http://localhost:${PUERTO}`
    );

});
