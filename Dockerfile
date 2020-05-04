FROM node:12-alpine
WORKDIR /home/node/app
RUN chown -R node:node /home/node/app
COPY package*.json ./
USER node
RUN npm install
COPY --chown=node:node . .
ENV PORT 8080
EXPOSE 8080
CMD ["npm", "start"]
