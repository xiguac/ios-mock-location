FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY picker ./picker

ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_FILE=/data/loc.json
EXPOSE 8080

CMD ["node", "picker/server.js"]
