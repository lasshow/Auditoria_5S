# Usar una imagen ligera de Node.js
FROM node:18-alpine

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de dependencias primero (para aprovechar el caché de Docker)
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el resto del código de la aplicación
COPY . .

# Exponer el puerto que usa la aplicación
EXPOSE 3000

# Crear directorio de datos por si acaso (aunque el código ya lo hace)
RUN mkdir -p data

# Comando para iniciar la aplicación
CMD ["npm", "start"]
