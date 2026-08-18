FROM node:20-alpine
WORKDIR /app
ARG API_URL=http://api:4000
ENV API_URL=$API_URL
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
