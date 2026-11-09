
import snmp from "net-snmp";

// ===== CONFIGURACION SNMPv3 TP-LINK =====

function crearSesionTPLink() {

    const usuario = {
        name: process.env.TPLINK_USER,
        level: snmp.SecurityLevel.authPriv,
        authProtocol: snmp.AuthProtocols.sha,
        authKey: process.env.TPLINK_AUTH_PASS,
        privProtocol: snmp.PrivProtocols.des,
        privKey: process.env.TPLINK_PRIV_PASS
    };

    return snmp.createV3Session(
        process.env.TPLINK_HOST,
        usuario,
        {
            port: 161,
            retries: 1,
            timeout: 3000
        }
    );
}

// ===== INFORMACION GENERAL DEL SWITCH =====

export function consultarTPLink() {

    return new Promise((resolve, reject) => {

        if (process.env.TPLINK_ENABLED !== "true") {
            resolve({ estado: "no_configurado" });
            return;
        }

        const sesion = crearSesionTPLink();

        const oids = [
            "1.3.6.1.2.1.1.5.0", // Nombre
            "1.3.6.1.2.1.1.3.0", // Uptime
            "1.3.6.1.2.1.1.1.0"  // Descripcion
        ];

        sesion.get(oids, (error, resultados) => {

            sesion.close();

            if (error) {
                reject(error);
                return;
            }

            if (resultados.some(snmp.isVarbindError)) {
                reject(new Error("Error en respuesta SNMP"));
                return;
            }

            resolve({
                estado: "conectado",
                nombre: resultados[0].value.toString(),
                uptimeSegundos: Number(resultados[1].value) / 100,
                descripcion: resultados[2].value.toString()
            });
        });
    });
}

// ===== DESCUBRIMIENTO DE INTERFACES TP-LINK =====

function consultarTabla(oid) {
    return new Promise((resolve, reject) => {

        const sesion = crearSesionTPLink();
        const valores = new Map();

        sesion.subtree(
            oid,
            10,
            (varbinds) => {
                for (const vb of varbinds) {
                    if (snmp.isVarbindError(vb)) continue;

                    const indice = Number(vb.oid.split(".").pop());
                    valores.set(indice, vb.value);
                }
            },
            (error) => {
                sesion.close();
                if (error) return reject(error);
                resolve(valores);
            }
        );
    });
}

function clasificarTipo(tipo) {
    switch (Number(tipo)) {
        case 6: return "ethernet";
        case 135:
        case 136: return "vlan";
        case 209: return "bridge";
        default: return "otras";
    }
}

export async function descubrirInterfacesTPLink() {

    if (process.env.TPLINK_ENABLED !== "true") {
        return [];
    }

    const [nombres, alias, tipos] = await Promise.all([
        consultarTabla("1.3.6.1.2.1.31.1.1.1.1"),
        consultarTabla("1.3.6.1.2.1.31.1.1.1.18"),
        consultarTabla("1.3.6.1.2.1.2.2.1.3")
    ]);

    return [...nombres.entries()].map(([indice, valor]) => {

        const nombre = valor.toString();
        const descripcion = alias.get(indice)?.toString().trim() || "";

        return {
            indice,
            nombre: descripcion || nombre,
            nombreOriginal: nombre,
            descripcion,
            tipo: /^vlan-interface\d+$/i.test(nombre)
    ? "vlan"
    : clasificarTipo(tipos.get(indice))
        };

    }).sort((a, b) => a.indice - b.indice);
}

// ===== CONSULTA DE CONTADORES =====

function consultarOidsTPLink(oids) {
    return new Promise((resolve, reject) => {
        const sesion = crearSesionTPLink();

        sesion.get(oids, (error, resultados) => {
            sesion.close();

            if (error) return reject(error);

            if (resultados.some(snmp.isVarbindError)) {
                return reject(new Error("Error consultando OID TP-Link"));
            }

            resolve(resultados);
        });
    });
}

function leerContador64(valor) {

    if (!Buffer.isBuffer(valor)) {
        return BigInt(valor);
    }

    let resultado = 0n;

    for (const byte of valor) {
        resultado = (resultado << 8n) | BigInt(byte);
    }

    return resultado;
}

const anterioresTPLink = new Map();

// ===== ESTADO Y TRAFICO =====

export async function consultarInterfacesTPLink() {

    if (process.env.TPLINK_ENABLED !== "true") {
        return [];
    }

    const interfaces = await descubrirInterfacesTPLink();
    const resultados = [];

    // Consultas en grupos pequeños para evitar
    // respuestas SNMP demasiado grandes.
    for (let inicio = 0; inicio < interfaces.length; inicio += 4) {

        const grupo = interfaces.slice(inicio, inicio + 4);
        const oids = [];

        for (const interfaz of grupo) {
            const i = interfaz.indice;

            oids.push(`1.3.6.1.2.1.2.2.1.8.${i}`);
            oids.push(`1.3.6.1.2.1.31.1.1.1.6.${i}`);
            oids.push(`1.3.6.1.2.1.31.1.1.1.10.${i}`);
        }

        const respuesta = await consultarOidsTPLink(oids);
        const ahora = process.hrtime.bigint();

        for (let p = 0; p < grupo.length; p++) {

            const interfaz = grupo[p];
            const base = p * 3;

            const estado = Number(respuesta[base].value);
            const rx = leerContador64(respuesta[base + 1].value);
            const tx = leerContador64(respuesta[base + 2].value);

            let rxMbps = null;
            let txMbps = null;

            const anterior = anterioresTPLink.get(interfaz.indice);

            if (anterior) {
                const segundos = Number(ahora - anterior.tiempo) / 1e9;

                if (segundos > 0 && rx >= anterior.rx && tx >= anterior.tx) {
                    rxMbps = Number((
                        Number(rx - anterior.rx) * 8 / segundos / 1e6
                    ).toFixed(3));

                    txMbps = Number((
                        Number(tx - anterior.tx) * 8 / segundos / 1e6
                    ).toFixed(3));
                }
            }

            anterioresTPLink.set(interfaz.indice, {
                rx, tx, tiempo: ahora
            });

            resultados.push({
                ...interfaz,
                estado: estado === 1 ? "activa" : "inactiva",
                rxMbps,
                txMbps
            });
        }
    }

    return resultados;
}
