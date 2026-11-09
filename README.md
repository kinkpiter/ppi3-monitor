# Monitor PPIII

## Trabajo Práctico Final Integrador – Práctica Profesionalizante III

### 1. Descripción del proyecto

Monitor PPIII es una aplicación web desarrollada para supervisar los recursos de hardware y el estado de un servidor GNU/Linux, además de incorporar el monitoreo de dispositivos de red mediante SNMPv3.

El sistema utiliza Node.js y la librería `systeminformation` para obtener información del servidor. Mediante Express expone una API REST, mientras que Socket.IO permite actualizar los datos en tiempo real.

También incorpora servicios de consulta SNMPv3 para un router MikroTik y un switch administrable TP-Link.

### 2. Objetivos

- Desarrollar una aplicación de monitoreo para GNU/Linux.
- Obtener estadísticas de CPU, RAM, almacenamiento y otros recursos del sistema.
- Implementar una API REST mediante Node.js y Express.
- Utilizar Socket.IO para la actualización de información.
- Desarrollar una interfaz web con HTML, CSS, JavaScript y Bootstrap.
- Incorporar monitoreo de dispositivos de red mediante SNMPv3.
- Configurar el inicio automático utilizando systemd.
- Utilizar Git y GitHub para el control de versiones.
- Preparar una aplicación Android (APK) como extensión del proyecto.

### 3. Tecnologías utilizadas

**Backend**
- Node.js
- Express 5
- Socket.IO 4
- systeminformation 5
- net-snmp 3
- dotenv
- CORS

**Frontend**
- HTML5
- CSS3
- JavaScript
- Bootstrap

**Sistema operativo y herramientas**
- Debian GNU/Linux
- npm
- Git
- GitHub
- systemd
- VirtualBox

### 4. Funcionalidades implementadas

- Visualización de recursos del servidor GNU/Linux.
- Monitoreo de CPU, memoria RAM y almacenamiento.
- Consulta de información del sistema operativo.
- Consulta del tiempo de actividad del servidor.
- API REST para obtener información del sistema.
- Comunicación mediante Socket.IO.
- Dashboard web para visualizar los datos.
- Integración de consultas SNMPv3.
- Monitoreo de router MikroTik.
- Monitoreo de switch TP-Link.
- Consulta de interfaces del MikroTik.
- Consulta de recursos del MikroTik.
- Inicio automático del backend mediante systemd.

### 5. Estructura del proyecto

```text
ppi3-monitor/
├── backend/
│   ├── .env
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js
│   └── services/
│       ├── mikrotik.js
│       └── tplink.js
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── docs/
│   └── README.md
├── mobile/
│   └── README.md
├── .gitignore
└── README.md
```

El archivo `.env` contiene variables de configuración y no debe incorporarse al repositorio público.

### 6. Instalación y ejecución

**Requisitos:**
- GNU/Linux.
- Node.js y npm.
- Navegador web.
- Acceso de red a los dispositivos que se desea monitorear.

Ingresar al backend:

```bash
cd /var/www/ppi3-monitor/backend
```

Instalar las dependencias:

```bash
npm install
```

Iniciar el backend:

```bash
npm start
```

El servidor utiliza el puerto 3001 en la configuración actual.

Para acceder a la interfaz desde el mismo servidor, utilizar la dirección correspondiente a la aplicación web:

```text
http://localhost:3001
```

### 7. Endpoints de la API REST

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/health` | Verifica el estado del backend |
| GET | `/api/sysinfo` | Obtiene información del servidor GNU/Linux |
| GET | `/api/network/mikrotik` | Consulta información del MikroTik |
| GET | `/api/network/mikrotik/interfaces` | Consulta interfaces del MikroTik |
| GET | `/api/network/mikrotik/recursos` | Consulta recursos del MikroTik |
| GET | `/api/network/tplink` | Consulta información del TP-Link |

### 8. Comunicación en tiempo real

La aplicación utiliza Socket.IO para enviar información del backend al navegador sin necesidad de actualizar manualmente la página.

Se identificaron los siguientes eventos:

- `recursos`
- `mikrotik`
- `interfacesMikrotik`
- `recursosMikrotik`
- `tplink`

El backend incorpora actualizaciones periódicas de información del servidor y consultas a dispositivos de red.

### 9. Monitoreo de dispositivos mediante SNMPv3

Se implementaron dos servicios independientes:

**MikroTik**

Archivo: `backend/services/mikrotik.js`

Permite obtener información del router, consultar interfaces y recursos disponibles mediante SNMPv3.

**TP-Link**

Archivo: `backend/services/tplink.js`

Permite obtener información del switch administrable mediante SNMPv3.

La configuración de los equipos se administra mediante variables de entorno en el archivo `backend/.env`.

Entre las variables utilizadas se encuentran:

```dotenv
MIKROTIK_HOST=10.50.20.1
TPLINK_HOST=10.50.0.2
```

Estas direcciones corresponden a la red utilizada durante el desarrollo y deben adaptarse cuando se trabaja en otra infraestructura.

Las credenciales SNMPv3 no deben publicarse en GitHub.

### 10. Servicio systemd

El proyecto dispone de un servicio denominado:

```text
ppi3-monitor.service
```

Permite ejecutar el backend automáticamente al iniciar Debian.

Comandos de administración:

```bash
sudo systemctl status ppi3-monitor.service
sudo systemctl start ppi3-monitor.service
sudo systemctl stop ppi3-monitor.service
sudo systemctl restart ppi3-monitor.service
```

Para consultar los registros:

```bash
sudo journalctl -u ppi3-monitor.service -n 30 --no-pager
```

Se verificó que la aplicación inicia automáticamente después de reiniciar el sistema operativo.

### 11. Desarrollo y control de versiones

El proyecto se desarrolla individualmente utilizando Git para controlar las modificaciones.

El repositorio contiene un archivo `.gitignore` para evitar incorporar dependencias, registros y archivos de configuración sensibles.

Se comprobó que `backend/.env` está excluido del seguimiento actual de Git.

### 12. Funcionalidades pendientes

- Incorporación de diagramas adicionales de arquitectura.
- Ampliación de las pruebas en diferentes redes.
- Posibles mejoras de administración de dispositivos SNMP.

### 13. Autor y estado del proyecto

**Trabajo Práctico Final Integrador — Práctica Profesionalizante III**

Desarrollo individual.

**Backend:** versión 1.0.0.

**Aplicación Android:** versión 1.0.1.

**Estado:** aplicación web y móvil funcionales.

El sistema permite monitorear recursos de GNU/Linux mediante una interfaz web y una aplicación Android, utilizando Node.js, Express y Socket.IO.

También incorpora consultas SNMPv3 para dispositivos MikroTik y TP-Link.

El backend se ejecuta automáticamente mediante systemd.

### 14. Aplicación Android

Se desarrolló una versión móvil de Monitor PPIII utilizando HTML2APK V2.

La aplicación reutiliza el frontend HTML, CSS y JavaScript del proyecto, adaptado para ejecutarse en Android mediante WebView.

**Características:**

- Aplicación Android en formato APK.
- Versión 1.0.1.
- Compatible desde Android 8.0 (API 26).
- Configuración de la dirección IP del servidor.
- Almacenamiento local de la dirección configurada.
- Comunicación con Node.js mediante API REST y Socket.IO.
- Visualización de CPU, RAM, disco y gráficos en tiempo real.
- Uso de Bootstrap y Chart.js incorporados localmente.

**Arquitectura:**

Android APK → Red → Debian → Node.js → API REST / Socket.IO

El servidor Debian obtiene la información del sistema y consulta los dispositivos de red mediante SNMPv3.

La aplicación Android funciona como cliente y requiere conectividad con el servidor para recibir las métricas.

**Pruebas realizadas:**

- Generación y firma del APK mediante HTML2APK V2.
- Instalación de la aplicación en un dispositivo Android.
- Configuración de la dirección del servidor.
- Conexión satisfactoria con el backend Node.js.
- Visualización correcta de los títulos.
- Actualización de CPU, RAM y disco.
- Funcionamiento de gráficos en tiempo real.

**Resultado:** versión Android 1.0.1 funcional y validada en las pruebas realizadas.
