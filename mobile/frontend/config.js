// CONFIGURACION DEL SERVIDOR PPI3

let servidor = localStorage.getItem("ppi3_servidor") || "";

function obtenerServidor() {
    return servidor;
}

function iniciarMonitor() {
    if (!servidor) return;

    const script = document.createElement("script");
    script.src = "js/app.js";
    document.body.appendChild(script);
}

function mostrarConfiguracion() {

    const panel = document.createElement("div");

    panel.id = "configuracionServidor";

    panel.style.cssText = `
        position:fixed;
        inset:0;
        background:#f1f3f5;
        z-index:9999;
        display:flex;
        justify-content:center;
        align-items:center;
        padding:20px;
    `;

    panel.innerHTML = `
        <div style="background:white;padding:25px;
                    border-radius:12px;width:100%;
                    max-width:400px;">

            <h2>PPI3 Monitor</h2>
            <p>Configuración del servidor Debian</p>

            <input id="direccionServidor"
                   placeholder="http://192.168.1.100:3001"
                   value="${servidor}"
                   style="width:100%;padding:12px;
                          box-sizing:border-box;">

            <button id="guardarServidor"
                    style="width:100%;margin-top:15px;
                           padding:12px;background:#0d6efd;
                           color:white;border:0;">
                Guardar y conectar
            </button>
        </div>
    `;

    document.body.appendChild(panel);

    document.getElementById("guardarServidor").onclick = function() {

        let direccion = document.getElementById(
            "direccionServidor"
        ).value.trim();

        if (!direccion.startsWith("http")) {
            direccion = "http://" + direccion;
        }

        servidor = direccion.replace(/\/+$/, "");

        localStorage.setItem("ppi3_servidor", servidor);

        location.reload();
    };
}

if (!servidor) {
    mostrarConfiguracion();
} else {
    iniciarMonitor();
}
