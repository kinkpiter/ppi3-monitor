
import snmp from "net-snmp";

// ===== CONFIGURACION SNMPv3 =====

function crearSesion() {
    const usuario = {
        name: process.env.MIKROTIK_USER,
        level: snmp.SecurityLevel.authPriv,
        authProtocol: snmp.AuthProtocols.sha,
        authKey: process.env.MIKROTIK_AUTH_PASS,
        privProtocol: snmp.PrivProtocols.aes,
        privKey: process.env.MIKROTIK_PRIV_PASS
    };

    return snmp.createV3Session(
        process.env.MIKROTIK_HOST,
        usuario,
        {
            port: 161,
            retries: 1,
            timeout: 3000
        }
    );
}

// ===== CLASIFICACION DE INTERFACES =====

function clasificarInterfaz(ifType) {
    switch (Number(ifType)) {
        case 6:
            return "ethernet";
        case 135:
        case 136:
            return "vlan";
        case 209:
            return "bridge";
        default:
            return "otras";
    }
}

// Consultar la tabla ifType completa
function obtenerTiposInterfaces() {
    return new Promise((resolve, reject) => {

        const sesion = crearSesion();
        const tipos = new Map();

        sesion.subtree(
            "1.3.6.1.2.1.2.2.1.3",
            10,
            (varbinds) => {
                for (const vb of varbinds) {
                    if (snmp.isVarbindError(vb)) continue;

                    const indice = Number(
                        vb.oid.split(".").pop()
                    );

                    tipos.set(
                        indice,
                        clasificarInterfaz(vb.value)
                    );
                }
            },
            (error) => {
                sesion.close();

                if (error) return reject(error);

                resolve(tipos);
            }
        );
    });
}


// ===== CONSULTA SNMP =====

function consultarOids(oids) {
    return new Promise((resolve, reject) => {
        const sesion = crearSesion();

        sesion.get(oids, (error, resultados) => {
            sesion.close();

            if (error) {
                return reject(error);
            }

            if (resultados.some(snmp.isVarbindError)) {
                return reject(
                    new Error("Error en respuesta SNMP")
                );
            }

            resolve(resultados);
        });
    });
}

// ===== INFORMACION GENERAL =====

export async function consultarMikrotik() {

    if (process.env.MIKROTIK_ENABLED !== "true") {
        return { estado: "no_configurado" };
    }

    const resultados = await consultarOids([
        "1.3.6.1.2.1.1.5.0",
        "1.3.6.1.2.1.1.3.0"
    ]);

    return {
        estado: "conectado",
        nombre: resultados[0].value.toString(),
        uptimeSegundos: Number(resultados[1].value) / 100
    };
}

// ===== INTERFACES ETHERNET =====


// ===== DESCUBRIMIENTO DINAMICO DE INTERFACES =====

async function descubrirInterfaces() {

    return new Promise((resolve, reject) => {

        const sesion = crearSesion();


const interfaces = [];

        // OID ifName: nombre actual de cada interfaz
        const oid = "1.3.6.1.2.1.31.1.1.1.1";

        sesion.subtree(
            oid,
            10,

            (varbinds) => {

                for (const vb of varbinds) {

                    if (snmp.isVarbindError(vb)) {
                        continue;
                    }

                    const indice = Number(
                        vb.oid.split(".").pop()
                    );

                    interfaces.push({
                        indice,
                        nombre: vb.value.toString()
                    });
                }
            },

            (error) => {

                sesion.close();

                if (error) {
                    return reject(error);
                }

                interfaces.sort(
                    (a, b) => a.indice - b.indice
                );

                resolve(interfaces);
            }
        );
    });
}

// Almacena las lecturas anteriores en memoria
const lecturasAnteriores = new Map();

// Counter64 llega como Buffer desde net-snmp
// ===== CONVERTIR CONTADOR SNMP DE 64 BITS =====

function leerContador64(valor) {

    if (Buffer.isBuffer(valor)) {

        // El contador puede ocupar entre 1 y 9 bytes
        // debido a la codificación ASN.1 BER.
        if (valor.length < 1 || valor.length > 9) {
            throw new Error(
                `Longitud Counter64 inesperada: ${valor.length}`
            );
        }

        let resultado = 0n;

        for (const byte of valor) {
            resultado = (resultado << 8n) | BigInt(byte);
        }

        if (resultado > 0xFFFFFFFFFFFFFFFFn) {
            throw new Error("Counter64 fuera de rango");
        }

        return resultado;
    }

    return BigInt(valor);
}
export async function consultarInterfaces() {

    if (process.env.MIKROTIK_ENABLED !== "true") {
        return [];
    }
const INTERFACES = await descubrirInterfaces();
const tipos = await obtenerTiposInterfaces();
    const oids = [];

    for (const interfaz of INTERFACES) {
        const i = interfaz.indice;

        // Estado operativo
        oids.push(`1.3.6.1.2.1.2.2.1.8.${i}`);

        // Bytes recibidos
        oids.push(`1.3.6.1.2.1.31.1.1.1.6.${i}`);

        // Bytes transmitidos
        oids.push(`1.3.6.1.2.1.31.1.1.1.10.${i}`);
    }

    const resultados = await consultarOids(oids);
    const ahora = process.hrtime.bigint();
    const interfaces = [];

    for (let posicion = 0; posicion < INTERFACES.length; posicion++) {

        const interfaz = INTERFACES[posicion];
        const base = posicion * 3;

        const estado = Number(resultados[base].value);
        const rx = leerContador64(resultados[base + 1].value);
        const tx = leerContador64(resultados[base + 2].value);

        let rxMbps = null;
        let txMbps = null;

        const anterior = lecturasAnteriores.get(interfaz.indice);

        if (anterior) {
            const segundos = Number(ahora - anterior.tiempo) / 1e9;

            if (segundos > 0 && rx >= anterior.rx && tx >= anterior.tx) {
                rxMbps = Number(
                    ((Number(rx - anterior.rx) * 8) /
                    segundos / 1_000_000).toFixed(3)
                );

                txMbps = Number(
                    ((Number(tx - anterior.tx) * 8) /
                    segundos / 1_000_000).toFixed(3)
                );
            }
        }

        lecturasAnteriores.set(interfaz.indice, {
            rx,
            tx,
            tiempo: ahora
        });


            interfaces.push({
    nombre: interfaz.nombre,
    indice: interfaz.indice,
    tipo: tipos.get(interfaz.indice) ?? "otras",
            estado: estado === 1 ? "activa" : "inactiva",
            rxMbps,
            txMbps
        });
    }

    return interfaces;
}


// ===== RECURSOS CPU Y RAM MIKROTIK =====

// OID de carga de los procesadores
const OID_CPU = "1.3.6.1.2.1.25.3.3.1.2";

// OID de memoria principal, según la identificación SNMP
const OID_RAM_UNIDAD = "1.3.6.1.2.1.25.2.3.1.4.65536";
const OID_RAM_TOTAL = "1.3.6.1.2.1.25.2.3.1.5.65536";
const OID_RAM_USADA = "1.3.6.1.2.1.25.2.3.1.6.65536";

// Obtener todas las CPU sin fijar su cantidad
function consultarCPUs() {
    return new Promise((resolve, reject) => {
        const sesion = crearSesion();
        const valores = [];

        sesion.subtree(
            OID_CPU,
            10,
            (varbinds) => {
                for (const vb of varbinds) {
                    if (snmp.isVarbindError(vb)) continue;
                    const valor = Number(vb.value);
                    if (Number.isFinite(valor)) {
                        valores.push(valor);
                    }
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

export async function consultarRecursosMikrotik() {

    if (process.env.MIKROTIK_ENABLED !== "true") {
        return { estado: "no_configurado" };
    }

    const [cpus, ram] = await Promise.all([
        consultarCPUs(),
        consultarOids([
            OID_RAM_UNIDAD,
            OID_RAM_TOTAL,
            OID_RAM_USADA
        ])
    ]);

    const unidad = Number(ram[0].value);
    const total = Number(ram[1].value);
    const usada = Number(ram[2].value);

    if (
        cpus.length === 0 ||
        !Number.isFinite(unidad) || unidad <= 0 ||
        !Number.isFinite(total) || total <= 0 ||
        !Number.isFinite(usada) || usada < 0
    ) {
        throw new Error("Métricas SNMP no válidas");
    }

    const cpuPromedio =
        cpus.reduce((suma, valor) => suma + valor, 0) /
        cpus.length;

    return {
        estado: "conectado",

        cpu: {
            nucleos: cpus.length,
            porcentaje: Number(cpuPromedio.toFixed(2))
        },

        ram: {
            totalMiB: Number(
                ((total * unidad) / 1048576).toFixed(2)
            ),
            usadaMiB: Number(
                ((usada * unidad) / 1048576).toFixed(2)
            ),
            porcentaje: Number(
                ((usada / total) * 100).toFixed(2)
            )
        }
    };
}
