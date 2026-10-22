
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

const INTERFACES = [
    { indice: 2, nombre: "WAN-ISP" },
    { indice: 3, nombre: "ether2" },
    { indice: 4, nombre: "ether3" },
    { indice: 5, nombre: "ether4" },
    { indice: 6, nombre: "ether5" }
];

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
            estado: estado === 1 ? "activa" : "inactiva",
            rxMbps,
            txMbps
        });
    }

    return interfaces;
}

