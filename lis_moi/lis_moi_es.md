[Français](../README.md) [Kreyòl](lis_moi_ht.md)

# Mugen WA Bot ♾️♾️
| Mugen | Menu |
|-------|------|
| <img src="image_mugen.jpg" width="875"> | <img src="image_menu.jpg" width="250"> <img src="image_menu1.jpg" width="250"> |

[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/fr)
[![Baileys](https://img.shields.io/badge/Library-Baileys-blue?logo=github)](https://github.com/WhiskeySockets/Baileys)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Multi--Device-green?logo=whatsapp)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/moneythemoney999/mugen_wa_bot?tab=MIT-1-ov-file)

* Un bot de WhatsApp potente y modular, muy flexible y multilingüe.

## ~Tabla de contenidos~

- [Acerca de](#acerca-de)
- [Características](#características)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Uso](#uso)
	- [Inicio del bot](#inicio-del-bot)
	- [Autenticación](#autenticación)
	- [Comandos](#comandos)
	- [Herramientas](#herramientas)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Contribuir](#contribuir)
- [Licencia](#licencia)
- [Autor](#autor)

## ~Acerca de~

Mugen WA Bot♾️♾️ es un bot de WhatsApp versátil y extensible, creado por un pequeño desarrollador independiente, construido con Node.js y utilizando la biblioteca Baileys para interactuar con la API de WhatsApp Multi-Device. Su diseño modular permite añadir fácilmente nuevos comandos, herramientas y funcionalidades de todo tipo. Es capaz de gestionar múltiples sesiones simultáneamente.

## ~Características~

🧩 **Modular y Extensible** : Añade fácilmente nuevas funcionalidades, comandos y herramientas personalizadas.
💬 **Interacciones de WhatsApp** : Gestiona mensajes, grupos, participantes y los identificadores LID, PN, JID.
♾️ **Gestión Multi-Sesión** : Ejecuta múltiples instancias del bot simultáneamente con sesiones y números distintos.
🔌 **Autenticación Flexible** : Soporta autenticación por Código QR o código de emparejamiento.
🌐 **Multilingüe** : Toma en carga varios y diferentes idiomas.

## ~Tecnologías Utilizadas~

*	**Node.js** 24 (Ejecutor de JavaScript fuera del navegador)
*	**Whiskeysockets Baileys** 7.0.0-rc.14 (API de WhatsApp Multi-Device)
*	**qrcode-terminal** (Generación de códigos QR en la terminal)
*	**NPM** (Gestor de paquetes Javascript)
*	Y otros módulos estándar de Node.js como `fs`, `path`, `readline`, `util`.

## ~Requisitos previos~

Antes de comenzar, asegúrate de tener instalados los siguientes elementos:

*	**Node.js** (v20, pero la versión 24 es altamente recomendada en Termux)
*	**NPM** o **yarn** (Gestor de paquetes)

## ~Instalación~

Sigue estos pasos para configurar y ejecutar el bot:

1.	**Clona el repositorio:**
	```bash
	git clone https://github.com/moneythemoney999/mugen_wa_bot.git
	cd mugen_wa_bot
	```

2.	**Instalación de dependencias:**
	### **Linux, Windows, macOS y entorno Linux en Termux (proot/chroot):**
	```bash
	NPM install
	```
	o
	```bash
	yarn install
	```

	### **Termux sin entorno Linux proot o chroot instalado:**
	**Para los usuarios de Termux (de forma nativa sin entorno Linux instalado encima), no debes usar `NPM/yarn install` ya que una de las dependencias necesarias no está precompilada para Termux.*

	- Bueno, yo ya lo hice por ti, pero debes usar específicamente Node v24.
	- Para beneficiarte de ello, debes ejecutar dos comandos:
		```bash
		chmod +x installation.sh && ./installation.sh # uno da permisos de ejecución al archivo y el otro lo ejecuta
		```
	- Esto hará lo necesario para descargar e instalar la dependencia correspondiente junto con las demás.

3.	**Configuración de sesiones (Opcional, pero necesario para multiple sesiones):**
	- Crea el archivo `session.js` en la raíz del proyecto (al mismo nivel que `mugen_wa_bot.js`) si no existe. En este archivo, puedes definir las sesiones que deseas iniciar. Cada llamada a `demarrer_bot("session")` iniciará una nueva sesión. Soporta comentarios tanto de una línea como multilínea.
	- Ejemplo de `session.js`:
		```javascript
		demarrer_bot("mugen");

		// Inicia otra sesión llamada "session1"
		/*
		demarrer_bot("session1");
		*/

		// Comenta/descomenta las líneas según las sesiones que quieras activar.
		// Las sesiones no comentadas se iniciarán al arrancar el bot.
		```
	- Si `session.js` no existe o está vacío, se iniciará una sesión por defecto llamada "mugen".

## ~Uso~

### Inicio del bot
* Para iniciar el bot, ejecuta el archivo principal `mugen_wa_bot.js`:

```bash
node mugen_wa_bot.js
```

### Autenticación

- En el primer inicio de una nueva sesión, el bot te pedirá que elijas un método de autenticación:

1.  **Código QR** : Se mostrará un código QR en la terminal. Escanéalo con tu teléfono: WhatsApp > Dispositivos vinculados > Vincular un dispositivo. Luego escanea el código.
2.  **Código de emparejamiento** : Debes introducir tu número de teléfono sin espacios, sin el signo más (+) ni paréntesis. Se te proporcionará un código que debes introducir yendo a: WhatsApp > Dispositivos vinculados > Vincular un dispositivo > Vincular con el número de teléfono en su lugar. Luego introdúcelo.

- Los archivos de autenticación se guardarán en la carpeta `.secret/.auth/<nombre_de_sesion>` para futuros reinicios.
- Por lo tanto, no los modifiques a menos que tengas una buena razón y sepas exactamente lo que haces.

## ~Comandos~

* El bot escucha los eventos de Baileys para transmitirlos a todos los comandos y herramientas, por si los necesitan. Después, también filtrará los mensajes que comiencen con el prefijo para ejecutar el comando o la herramienta correspondiente. Si no encuentra ninguno, enviará un mensaje para indicarlo.
* _Para la carga automática y búsqueda de comandos y herramientas, hay ciertas reglas a respetar._
* **Aquí tienes un ejemplo:**
```javascript
export default {
	nom : "nombre del comando",
	description : "descripción del comando",
	categorie : "categoría del comando",
	infos : "Más información sobre el comando que el bloque 'description'", // opcional
	execute : "Aquí va la lógica real del comando que se ejecutará al ser llamado {si hay argumentos que deseas importar desde el archivo principal, es aquí}"
}
```

## ~Herramientas~

- El bot utiliza un sistema de herramientas modulares que pueden reaccionar a diferentes eventos. Estas herramientas se cargan dinámiamente desde la carpeta `outils`.
- Ellas pueden trabajar en segundo plano sin necesidad de ser activadas por el prefijo, y pueden afectar el comportamiento del resto del bot.
- Al igual que con los comandos, hay ciertas reglas a respetar.
- __Ejemplo__ :
```javascript
export default {
	nom : "nombre de la herramienta",
	evenement : "el evento que esta herramienta quiere escuchar", // puede aceptar uno o varios
	description : "descripción de la herramienta",
	categorie : "...",
	infos : "...",
	affiche_menu : "{vrai/faux}", // Este campo permite no añadir la herramienta en el menú del bot si está destinada a trabajar en segundo plano. Si no está en el archivo o está definida como `false`, el menú no la mostrará.
	execute : "Al igual que con los comandos, aquí se encontrará la lógica a ejecutar"
}
```

## Estructura del Proyecto

```
.
├── commandes/					# Los commandos
├── outils/					# Las herramientas
├── langues/{el_idioma}/		# Carpetas/archivos de los diferentes idiomas
│						└── {el_idioma}.json # Las informaciones sobre el idioma (nombre, código)
│						└── commandes/
│						└── outils/
├── memoires/					# Carpeta para los datos persistente de las sesiones, commandos, herramientas
│	├── memoires_commandes/	# Comandos
│	├── memoires_sessions/		# Sesiones
│	└── memoires_outils/		# Herramientas
├── stockage					# ...
├── lis_moi/					# Carpeta que contiene imágenes y archivos readme traducidos en diferentes idiomas
├── .secret/					# Carpeta que contiene las informaciones sensibles
│	└── .auth/					# Datos de autenticación de las sesiones de WhatsApp
│	└── .cles_ia/				# Claves API de IA
├── mugen_wa_bot.js			# Archivo principal del bot
├── installation.sh			# Ejecutable de instalación de dependencias en Termux simple
├── package.json				# Información sobre el proyecto y las dependencias
├── package-lock.json			# Bloqueo de versiones de dependencias
├── session.js					# Archivo para configurar y lanzar múltiples sesiones
└── README.md					# El archivo README principal
```

## Contribuir

Como dije, es un proyecto en el que trabajo solo, pero si hay personas que desean contribuir, no me opongo 😅(→⁠_⁠→)(←⁠_⁠←).
Los espero

# Licencia

Este proyecto está bajo la licencia MIT y es de libre acceso, por lo que no me hago responsable de ningún mal uso.
[Licencia](LICENCE)

# Autor
[Money Mugen♾️♾️](https://github.com/moneythemoney999)
