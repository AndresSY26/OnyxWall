# 🌌 OnyxWall — El Destino Definitivo para Fondos de Pantalla OLED de Súper Lujo

OnyxWall (también conocido como *AeroWall Elegant Dark*) es una plataforma premium y ultra-sofisticada de arte digital y curaduría de fondos de pantalla optimizados para paneles OLED oscuros. El proyecto está construido para ofrecer una experiencia estética sobria, interactiva y de altísimo nivel utilizando tecnologías web modernas de vanguardia.

---

## 🎨 Características Destacadas

### 1. **Estética y Visual de Lujo (Obsidian Glassmorphism)**
*   **Tema Oscuro Profundo / Onyx**: Paleta de colores seleccionada meticulosamente en base a tonos `#080808` y `#0a0a0a`, diseñada específicamente para reducir el consumo y la fatiga ocular en paneles OLED.
*   **Modo Claro Suave**: Alternancia inteligente con tonos fríos y relajantes para una visibilidad fluida a plena luz del día.
*   **Interactividad Pulida**: Transiciones de color animadas, micro-interacciones interactivas de hover y tipografías perfectamente calibradas con el sistema.

### 2. **Búsqueda Dinámica y Filtros de Curaduría**
*   **Búsqueda en Tiempo Real**: Filtrado reactivo e instantáneo directo desde el panel de navegación.
*   **Filtro por Orientación**: Categorización rápida entre formato **Móvil (Vertical)** y **PC (Horizontal)**.
*   **Estilos Estéticos**: Clasificaciones que incluyen:
    *   *Líneas / Minimalista*
    *   *Negro Absoluto / OLED*
    *   *Cósmico / Espacial*
    *   *Arquitectura Modernista*
    *   *Paisajes Sombríos*

### 3. **Validación y Certificación por Inteligenia Artificial (Gemini API)**
*   **Validación de Calidad OLED**: AI integrada en el backend que escanea la estructura geométrica, niveles de contraste y ruido de las imágenes subidas por los usuarios.
*   **Seguridad SFW Automatizada**: Evita subidas de imágenes no deseadas garantizando un catálogo 100% seguro.
*   **Auto-tagging**: Enriquecimiento automático de descripciones y estilos clasificados por IA.

### 4. **Persistencia en la Nube con Firebase**
*   **Autenticación Fluida**: Inicio de sesión integrado con Google Auth (con un sistema de diagnóstico inteligente y fallback para desarrollo).
*   **Favoritos Sincronizados**: Los usuarios autenticados pueden marcar sus wallpapers favoritos y conservarlos de forma segura en sus perfiles sincronizados con Firestore.
*   **Sistema de Notificaciones Reales**:
    *   Alertas en la nube persistentes por usuario.
    *   Contador interactivo de notificaciones no leídas con badge animado.
    *   Simulador de alertas entrantes integrado para pruebas rápidas de UI.

### 5. **Consola de Administración y Auditoría (Dashboard Supervisor)**
*   **Cola de Moderación**: Solo los administradores aprobados pueden ver, aceptar o rechazar wallpapers pendientes de aprobación enviados por la comunidad.
*   **Registro de Auditoría de Descargas**: Telemetría integrada para rastrear descargas, incluyendo fecha, hora, correo y nombre de usuario para auditorías de seguridad eficaces.
*   **Modo Autónomo Local (Fallback)**: El sistema detecta automáticamente si Firestore o Auth tienen configuraciones pendientes y habilita de forma transparente un almacenamiento temporal en navegador para que los desarrolladores iteren sin interrupciones.

---

## 🛠️ Stack Tecnológico

*   **framework**: [Angular 21](https://angular.dev/) (Zoneless Completo, Signals reactivos para control de estado, flujo de datos nativo).
*   **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/) (diseño responsivo y fluid-grid).
*   **Lenguaje**: [TypeScript v5](https://www.typescriptlang.org/) con tipado estricto.
*   **Base de Datos y Auth**: [Firebase](https://firebase.google.com/) (Firestore Rules de seguridad robustas, autenticación).
*   **Inteligencia Artificial**: [SDK Oficial de Gemini API (@google/genai)](https://github.com/google/generative-ai-js) utilizando rutas del servidor seguras para ocultar la API Key al cliente.
*   **Servidor**: Node.js completo con soporte SSR (Renderizado en Servidor).

---

## 📁 Estructura del Proyecto

```text
├── angular.json                 # Configuración de Angular CLI y compilación
├── package.json                 # Gestión de dependencias y scripts de producción
├── firestore.rules              # Reglas de seguridad avanzadas para Firestore
├── metadata.json                # Metadatos del applet y definiciones de permisos
├── src/
│   ├── main.ts                  # Punto de entrada de inicialización de la app
│   ├── main.server.ts           # Inicialización SSR para renderizado del servidor
│   ├── server.ts                # Servidor Express híbrido, proxies de APIs y SSR
│   ├── index.html               # Plantilla base HTML del navegador
│   ├── styles.css               # Definición global de temas de Tailwind CSS v4
│   └── app/
│       ├── app.ts               # Componente principal (lógica del dashboard, estados)
│       ├── app.html             # Plantilla responsiva del dashboard OnyxWall
│       ├── app.css              # Estilos específicos locales de visuales
│       ├── app.config.ts        # Proveedores y servicios web para el cliente (Zoneless)
│       ├── app.config.server.ts # Proveedores del lado del servidor
│       └── services/
│           └── firebase.ts      # Enlace completo de métodos de comunicación con Firestore/Auth
```

---

## 🔒 Reglas de Seguridad de Firestore (`firestore.rules`)

El proyecto cuenta con estrictas reglas de acceso que separan y protegen la privacidad de los usuarios:

*   **Favoritos y Notificaciones**: Un usuario tiene permiso exclusivo de lectura/escritura (`read`, `write`) si y solo si su UID concuerda con el UID de la ruta (`request.auth.uid == userId`).
*   **Usuarios**: Cualquier usuario autenticado puede leer el catálogo, pero la creación de perfiles requiere validación.
*   **Wallpapers y Descargas**:
    *   Cualquier usuario puede leer wallpapers aprobados.
    *   Los registros de auditoría de descargas (`download_logs`) y la edición de wallpapers solo están permitidos para administradores con privilegios específicos o usuarios con correos listados de administración (`request.auth.token.email` en la lista segura).

---

## ⚙️ Instalación y Configuración de Desarrollo

### 1. Prerrequisitos
Asegúrate de tener instalado **Node.js 18+** y **npm** en tu sistema.

### 2. Instalación de dependencias
Instala los paquetes de desarrollo y librerías base:
```bash
npm install
```

### 3. Configuración de Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto (basado en `.env.example`) y añade las siguientes variables:
```env
# Clave secreta para IA del Backend (Segura, no expuesta en el cliente)
GEMINI_API_KEY=tu_api_key_aqui
```

### 4. Compilación e Inicio Local
Inicia el entorno de desarrollo adaptado a port 3000:
```bash
npm run dev
```

El servidor local estará disponible en: [http://localhost:3000](http://localhost:3000)

Para realizar una compilación completa de producción y arrancar el servidor híbrido consolidado:
```bash
npm run build
npm start
```

---

## 💡 Guía de Diagnósticos Rápidos para Firebase

En caso de observar banners amarillos de advertencia en el encabezado durante las pruebas, realiza lo siguiente:

*   **Caso: "Configuración de Firebase Pendiente"**: 
    1. Ve a tu consola de [Firebase](https://console.firebase.google.com/).
    2. Crea o selecciona tu base de datos **Cloud Firestore**.
    3. Habilítala en **Modo Prueba** para agilizar los registros iniciales y las aprobaciones de imágenes.
*   **Caso: "Google Auth Provider Deshabilitado"**:
    1. Dirígete a la sección de **Authentication** en Firebase Console.
    2. Entra a la pestaña **Sign-in method**.
    3. Activa el proveedor de **Google**, ingresa un correo de soporte y valida los cambios.
