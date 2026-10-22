// ===== GRAFICOS HISTORICOS =====

const MAX_MUESTRAS = 20;

function crearGrafico(id, nombre, color) {

    return new Chart(document.getElementById(id), {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: nombre,
                data: [],
                borderColor: color,
                tension: 0.3,
                fill: false
            }]
        },
        options: {
            responsive: true,
            animation: false,
            scales: {
                y: {
                    min: 0,
                    max: 100
                }
            }
        }
    });
}

const graficoCpu = crearGrafico(
    "graficoCpu", "CPU %", "#0d6efd"
);

const graficoRam = crearGrafico(
    "graficoRam", "RAM %", "#198754"
);

function agregarMuestra(grafico, valor, hora) {

    if (!Number.isFinite(Number(valor))) return;

    grafico.data.labels.push(hora);
    grafico.data.datasets[0].data.push(Number(valor));

    if (grafico.data.labels.length > MAX_MUESTRAS) {
        grafico.data.labels.shift();
        grafico.data.datasets[0].data.shift();
    }

    grafico.update();
}
// ===== ELEMENTOS =====

const estado = document.getElementById("estado");

// ===== ACTUALIZAR METRICAS =====

function actualizarRecursos(datos) {

    if (!datos) return;

    // CPU
    actualizarBarra("cpu", "barraCpu", datos.cpu?.uso);

    // RAM
    actualizarBarra("ram", "barraRam", datos.ram?.porcentaje);

    // DISCO
    actualizarBarra(
        "disco",
        "barraDisco",
        datos.disco?.porcentaje
    );

    // PROCESOS
    document.getElementById("procesos").textContent =
        datos.procesos ?? "--";

    // INFORMACION DEL SERVIDOR
    document.getElementById("hostname").textContent =
        datos.hostname ?? "--";

    document.getElementById("sistema").textContent =
        datos.distribucion ?? "--";

    document.getElementById("kernel").textContent =
        datos.kernel ?? "--";

    document.getElementById("arquitectura").textContent =
        datos.arquitectura ?? "--";

    document.getElementById("uptime").textContent =
        datos.uptime ?? "--";

    document.getElementById("fecha").textContent =
        datos.fecha ?? "--";
}

// ===== BARRAS DE PROGRESO =====

function actualizarBarra(elemento, barra, valor) {

    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        document.getElementById(elemento).textContent = "-- %";
        document.getElementById(barra).style.width = "0%";
        return;
    }

    const porcentaje = Math.min(100, Math.max(0, numero));

    document.getElementById(elemento).textContent =
        numero.toFixed(2) + " %";

    document.getElementById(barra).style.width =
        porcentaje + "%";
}

// ===== CONSULTA INICIAL HTTP =====

async function cargarDatos() {

    try {
        const respuesta = await fetch("/api/sysinfo");

        if (!respuesta.ok) {
            throw new Error("Error HTTP " + respuesta.status);
        }

        const datos = await respuesta.json();

        actualizarRecursos(datos);

    } catch (error) {
        console.error("Error consultando API:", error);
    }
}

// ===== SOCKET.IO =====

const socket = io();

socket.on("connect", () => {

    estado.textContent = "Conectado";
    estado.className = "badge bg-success";

    console.log("Socket conectado:", socket.id);
});

socket.on("recursos", (datos) => {

    actualizarRecursos(datos);

    const hora = new Date().toLocaleTimeString("es-AR");

    agregarMuestra(graficoCpu, datos.cpu?.uso, hora);

    agregarMuestra(graficoRam, datos.ram?.porcentaje, hora);


});

socket.on("disconnect", () => {

    estado.textContent = "Desconectado";
    estado.className = "badge bg-danger";

});

socket.on("connect_error", (error) => {

    estado.textContent = "Error de conexión";
    estado.className = "badge bg-danger";

    console.error(error.message);
});

// ===== NAVEGACION =====

function mostrarSeccion(seccion) {

    const esServidor = seccion === "servidor";

    document.getElementById("seccionServidor")
        .classList.toggle("d-none", !esServidor);

    document.getElementById("seccionRed")
        .classList.toggle("d-none", esServidor);

    document.getElementById("btnServidor")
        .classList.toggle("active", esServidor);

    document.getElementById("btnRed")
        .classList.toggle("active", !esServidor);
}

// ===== INICIO =====

cargarDatos();

// ===== MONITOREO MIKROTIK =====

function mostrarMikrotik(datos) {

    const estado = document.getElementById("estadoMikrotik");

    if (datos.estado === "conectado") {

        estado.textContent = "Conectado";
        estado.className = "badge bg-success";

        document.getElementById("nombreMikrotik").textContent =
            datos.nombre ?? "--";

        const segundos = Number(datos.uptimeSegundos) || 0;

        const dias = Math.floor(segundos / 86400);
        const horas = Math.floor((segundos % 86400) / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);

        document.getElementById("uptimeMikrotik").textContent =
            `${dias}d ${horas}h ${minutos}m`;

    } else {

        estado.textContent =
            datos.estado === "no_configurado"
                ? "No configurado"
                : "Desconectado";

        estado.className = "badge bg-secondary";

        document.getElementById("nombreMikrotik").textContent = "--";
        document.getElementById("uptimeMikrotik").textContent = "--";
    }
}

// Consulta inicial al endpoint HTTP
async function cargarMikrotik() {

    try {

        const respuesta = await fetch("/api/network/mikrotik");
        const datos = await respuesta.json();

        mostrarMikrotik(datos);

    } catch (error) {

        console.error("Error consultando MikroTik:", error);

        mostrarMikrotik({ estado: "desconectado" });
    }
}

// Actualización en tiempo real
socket.on("mikrotik", (datos) => {

    mostrarMikrotik(datos);

});

// Primera consulta
cargarMikrotik();

// ===== TABLA DE INTERFACES MIKROTIK =====

function mostrarInterfaces(interfaces) {

    const tabla = document.getElementById("tablaInterfaces");

    tabla.replaceChildren();

    if (!interfaces || interfaces.length === 0) {
        const fila = tabla.insertRow();
        const celda = fila.insertCell();
        celda.colSpan = 4;
        celda.textContent = "Sin datos de interfaces";
        return;
    }

    interfaces.forEach(interfaz => {

        const fila = tabla.insertRow();

        const nombre = fila.insertCell();
        nombre.textContent = interfaz.nombre;

        const estado = fila.insertCell();
        const etiqueta = document.createElement("span");

        etiqueta.className = interfaz.estado === "activa"
            ? "badge bg-success"
            : "badge bg-secondary";

        etiqueta.textContent = interfaz.estado;
        estado.appendChild(etiqueta);

        const rx = fila.insertCell();
        rx.textContent = interfaz.rxMbps == null
            ? "Calculando..."
            : interfaz.rxMbps.toFixed(3);

        const tx = fila.insertCell();
        tx.textContent = interfaz.txMbps == null
            ? "Calculando..."
            : interfaz.txMbps.toFixed(3);
    });
}

// Actualizaciones Socket.IO

socket.on("interfacesMikrotik", (interfaces) => {
    mostrarInterfaces(interfaces);
});

// Consulta inicial HTTP

async function cargarInterfaces() {
    try {
        const respuesta = await fetch(
            "/api/network/mikrotik/interfaces"
        );

        if (!respuesta.ok) {
            throw new Error("Error HTTP " + respuesta.status);
        }

        const datos = await respuesta.json();

        mostrarInterfaces(datos.interfaces);

    } catch (error) {
        console.error("Error cargando interfaces:", error);
    }
}

cargarInterfaces();
