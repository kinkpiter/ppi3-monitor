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


// ===== FILTRO DE INTERFACES =====

let interfacesRecibidas = [];

const filtroInterfaces = document.getElementById("filtroInterfaces");

filtroInterfaces.addEventListener("change", () => {
    mostrarInterfaces(interfacesRecibidas);
});
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

    const filtro = filtroInterfaces.value;

const interfacesFiltradas = interfaces.filter(interfaz => {
    return filtro === "todas" || interfaz.tipo === filtro;
});

interfacesFiltradas.forEach(interfaz => {
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
    interfacesRecibidas = interfaces;
    mostrarInterfaces(interfacesRecibidas);
    actualizarGraficoTrafico(interfacesRecibidas);
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

        interfacesRecibidas = datos.interfaces ?? [];
mostrarInterfaces(interfacesRecibidas);
actualizarGraficoTrafico(interfacesRecibidas);
    } catch (error) {
        console.error("Error cargando interfaces:", error);
    }
}

cargarInterfaces();

// ===== GRAFICO DE TRAFICO MIKROTIK =====

const selectorGrafico = document.getElementById("interfazGrafico");

const graficoTrafico = new Chart(
    document.getElementById("graficoTrafico"),
    {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "RX (Mbps)",
                    data: [],
                    borderColor: "#0d6efd",
                    tension: 0.3
                },
                {
                    label: "TX (Mbps)",
                    data: [],
                    borderColor: "#198754",
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Mbps"
                    }
                }
            }
        }
    }
);

let indiceSeleccionado = null;

selectorGrafico.addEventListener("change", () => {
    indiceSeleccionado = Number(selectorGrafico.value);
    graficoTrafico.data.labels = [];
    graficoTrafico.data.datasets.forEach(d => d.data = []);
    graficoTrafico.update();
});

function actualizarGraficoTrafico(interfaces) {

    // Mantener actualizado el listado de interfaces
    const anterior = selectorGrafico.value;

    selectorGrafico.replaceChildren();

    for (const interfaz of interfaces) {
        const opcion = document.createElement("option");
        opcion.value = String(interfaz.indice);
        opcion.textContent = interfaz.nombre;
        selectorGrafico.appendChild(opcion);
    }

    if (interfaces.length === 0) return;

    const existe = interfaces.some(i => String(i.indice) === anterior);

    selectorGrafico.value = existe
        ? anterior
        : String(interfaces[0].indice);

    const indiceActual = Number(selectorGrafico.value);

    if (indiceSeleccionado !== indiceActual) {
        indiceSeleccionado = indiceActual;
        graficoTrafico.data.labels = [];
        graficoTrafico.data.datasets.forEach(d => d.data = []);
    }

    const interfaz = interfaces.find(i => i.indice === indiceActual);

    if (!interfaz || interfaz.rxMbps == null || interfaz.txMbps == null) {
        return;
    }

    const hora = new Date().toLocaleTimeString("es-AR");

    graficoTrafico.data.labels.push(hora);
    graficoTrafico.data.datasets[0].data.push(interfaz.rxMbps);
    graficoTrafico.data.datasets[1].data.push(interfaz.txMbps);

    if (graficoTrafico.data.labels.length > 20) {
        graficoTrafico.data.labels.shift();
        graficoTrafico.data.datasets.forEach(d => d.data.shift());
    }

    graficoTrafico.update();
}

// ===== CPU Y RAM DEL MIKROTIK =====

function mostrarRecursosMikrotik(datos) {

    if (!datos || datos.estado !== "conectado") {

        document.getElementById("cpuMikrotik").textContent = "-- %";
        document.getElementById("ramMikrotik").textContent = "-- %";

        document.getElementById("barraCpuMikrotik").style.width = "0%";
        document.getElementById("barraRamMikrotik").style.width = "0%";

        document.getElementById("nucleosMikrotik").textContent = "--";
        document.getElementById("ramDetalleMikrotik").textContent =
            datos?.estado === "no_configurado"
                ? "Monitoreo no configurado"
                : "Sin datos disponibles";

        return;
    }

    // CPU
    const cpu = datos.cpu.porcentaje;

    actualizarBarra("cpuMikrotik", "barraCpuMikrotik", cpu);

    document.getElementById("nucleosMikrotik").textContent =
        datos.cpu.nucleos;

    // RAM
    const ram = datos.ram.porcentaje;

    actualizarBarra("ramMikrotik", "barraRamMikrotik", ram);

    document.getElementById("ramDetalleMikrotik").textContent =
        `${datos.ram.usadaMiB} MiB / ${datos.ram.totalMiB} MiB`;
}

// Recibir actualizaciones Socket.IO
socket.on("recursosMikrotik", (datos) => {
    mostrarRecursosMikrotik(datos);
});

// Consulta inicial HTTP
async function cargarRecursosMikrotik() {

    try {
        const respuesta = await fetch(
            "/api/network/mikrotik/recursos"
        );

        const datos = await respuesta.json();

        mostrarRecursosMikrotik(datos);

    } catch (error) {
        console.error("Error cargando CPU/RAM MikroTik:", error);

        mostrarRecursosMikrotik({
            estado: "desconectado"
        });
    }
}

cargarRecursosMikrotik();

// ===== MONITOREO TP-LINK =====

function mostrarTPLink(datos) {

    const estado = document.getElementById("estadoTPLink");
    const tabla = document.getElementById("tablaTPLink");

    tabla.replaceChildren();

    if (!datos || datos.estado !== "conectado") {

        estado.textContent =
            datos?.estado === "no_configurado"
                ? "No configurado"
                : "Desconectado";

        estado.className = "badge bg-secondary";

        document.getElementById("nombreTPLink").textContent = "--";
        document.getElementById("modeloTPLink").textContent = "--";
        document.getElementById("uptimeTPLink").textContent = "--";

        const fila = tabla.insertRow();
        const celda = fila.insertCell();
        celda.colSpan = 4;
        celda.textContent = "Sin datos disponibles";

        return;
    }

    estado.textContent = "Conectado";
    estado.className = "badge bg-success";

    document.getElementById("nombreTPLink").textContent =
        datos.nombre;

    document.getElementById("modeloTPLink").textContent =
        datos.descripcion;

    const segundos = Number(datos.uptimeSegundos) || 0;

    const dias = Math.floor(segundos / 86400);
    const horas = Math.floor((segundos % 86400) / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);

    document.getElementById("uptimeTPLink").textContent =
        `${dias}d ${horas}h ${minutos}m`;

    for (const interfaz of datos.interfaces ?? []) {

        const fila = tabla.insertRow();

        fila.insertCell().textContent = interfaz.nombre;

        const celdaEstado = fila.insertCell();
        const etiqueta = document.createElement("span");

        etiqueta.className =
            interfaz.estado === "activa"
                ? "badge bg-success"
                : "badge bg-secondary";

        etiqueta.textContent = interfaz.estado;
        celdaEstado.appendChild(etiqueta);

        fila.insertCell().textContent =
            interfaz.rxMbps == null
                ? "Calculando..."
                : Number(interfaz.rxMbps).toFixed(3);

        fila.insertCell().textContent =
            interfaz.txMbps == null
                ? "Calculando..."
                : Number(interfaz.txMbps).toFixed(3);
    }
}

// Actualizaciones Socket.IO
socket.on("tplink", actualizarPanelTPLink);
// Consulta inicial HTTP
async function cargarTPLink() {

    try {
        const respuesta = await fetch("/api/network/tplink");

        if (!respuesta.ok) {
            throw new Error(`HTTP ${respuesta.status}`);
        }

        actualizarPanelTPLink(await respuesta.json());

    } catch (error) {
        console.error("Error cargando TP-Link:", error);
        actualizarPanelTPLink({ estado: "desconectado" });
    }
}

cargarTPLink();

// ===== FILTRO Y GRAFICO DEL TP-LINK =====

let interfacesTPLinkRecibidas = [];

const filtroTPLink = document.getElementById("filtroTPLink");
const selectorTPLink = document.getElementById("interfazGraficoTPLink");

const graficoTPLink = new Chart(
    document.getElementById("graficoTraficoTPLink"),
    {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "RX (Mbps)",
                    data: [],
                    borderColor: "#0d6efd",
                    tension: 0.3
                },
                {
                    label: "TX (Mbps)",
                    data: [],
                    borderColor: "#198754",
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Mbps"
                    }
                }
            }
        }
    }
);

function actualizarResumenTPLink(interfaces) {

    const ethernet = interfaces.filter(
        interfaz => interfaz.tipo === "ethernet"
    );

    const activos = ethernet.filter(
        interfaz => interfaz.estado === "activa"
    ).length;

    document.getElementById("puertosActivosTPLink").textContent =
        activos;

    document.getElementById("puertosInactivosTPLink").textContent =
        ethernet.length - activos;

    document.getElementById("totalPuertosTPLink").textContent =
        ethernet.length;
}

function filtrarInterfacesTPLink() {

    const filtro = filtroTPLink.value;
    const tabla = document.getElementById("tablaTPLink");

    tabla.replaceChildren();

    const interfaces = interfacesTPLinkRecibidas.filter(
        interfaz =>
            filtro === "todas" || interfaz.tipo === filtro
    );

    if (interfaces.length === 0) {
        const fila = tabla.insertRow();
        const celda = fila.insertCell();
        celda.colSpan = 4;
        celda.textContent = "No hay interfaces de este tipo";
        return;
    }

    for (const interfaz of interfaces) {
        const fila = tabla.insertRow();

        fila.insertCell().textContent = interfaz.nombre;

        const estado = fila.insertCell();
        const badge = document.createElement("span");

        badge.className = interfaz.estado === "activa"
            ? "badge bg-success"
            : "badge bg-secondary";

        badge.textContent = interfaz.estado;
        estado.appendChild(badge);

        fila.insertCell().textContent =
            interfaz.rxMbps == null
                ? "Calculando..."
                : Number(interfaz.rxMbps).toFixed(3);

        fila.insertCell().textContent =
            interfaz.txMbps == null
                ? "Calculando..."
                : Number(interfaz.txMbps).toFixed(3);
    }
}

filtroTPLink.addEventListener(
    "change",
    filtrarInterfacesTPLink
);

// ===== GRAFICO RX/TX =====

function limpiarGraficoTPLink() {
    graficoTPLink.data.labels = [];
    graficoTPLink.data.datasets.forEach(
        dataset => dataset.data = []
    );
    graficoTPLink.update();
}

selectorTPLink.addEventListener(
    "change",
    limpiarGraficoTPLink
);

function actualizarGraficoTPLink(interfaces) {

    const seleccionado = selectorTPLink.value;

    selectorTPLink.replaceChildren();

    for (const interfaz of interfaces) {
        const opcion = document.createElement("option");

        opcion.value = String(interfaz.indice);
        opcion.textContent = interfaz.nombre;

        selectorTPLink.appendChild(opcion);
    }

    if (!interfaces.length) {
        limpiarGraficoTPLink();
        return;
    }

    const existe = interfaces.some(
        interfaz => String(interfaz.indice) === seleccionado
    );

    selectorTPLink.value = existe
        ? seleccionado
        : String(interfaces[0].indice);

    if (!existe && seleccionado !== "") {
        limpiarGraficoTPLink();
    }

    const interfaz = interfaces.find(
        interfaz =>
            String(interfaz.indice) === selectorTPLink.value
    );

    if (
        !interfaz ||
        interfaz.rxMbps == null ||
        interfaz.txMbps == null
    ) {
        return;
    }

    graficoTPLink.data.labels.push(
        new Date().toLocaleTimeString("es-AR")
    );

    graficoTPLink.data.datasets[0].data.push(
        interfaz.rxMbps
    );

    graficoTPLink.data.datasets[1].data.push(
        interfaz.txMbps
    );

    if (graficoTPLink.data.labels.length > 20) {
        graficoTPLink.data.labels.shift();

        graficoTPLink.data.datasets.forEach(
            dataset => dataset.data.shift()
        );
    }

    graficoTPLink.update();
}

function actualizarPanelTPLink(datos) {

    // Mantener funcionando la tarjeta original
    mostrarTPLink(datos);

    interfacesTPLinkRecibidas =
        datos?.estado === "conectado"
            ? datos.interfaces ?? []
            : [];

    if (datos?.estado === "conectado") {
        actualizarResumenTPLink(interfacesTPLinkRecibidas);
        filtrarInterfacesTPLink();
        actualizarGraficoTPLink(interfacesTPLinkRecibidas);
    } else {
        ["puertosActivosTPLink",
         "puertosInactivosTPLink",
         "totalPuertosTPLink"].forEach(id => {
            document.getElementById(id).textContent = "--";
        });

        limpiarGraficoTPLink();
        selectorTPLink.replaceChildren();
    }
}
