FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
CMD ["sh","-c","node src/migrate.js && node src/seed.js && node src/server.js"]
