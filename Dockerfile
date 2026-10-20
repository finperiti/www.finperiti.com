# finperiti.com — static site served by unprivileged nginx on :8080
# Build stage: zero-dependency Node build (no npm install needed)
FROM node:20-alpine AS build
WORKDIR /site
# nginx.conf comes along so the build can check its CSP matches the one in scripts/build.mjs
COPY package.json site.config.json nginx.conf ./
COPY scripts ./scripts
COPY src ./src
ARG SITE_URL
ARG APP_URL
ARG FORM_ACCESS_KEY
RUN node scripts/build.mjs
# The image builds offline and reproducibly: no files are fetched from the live site here
# (scripts/carry-over-assets.mjs is a GitHub Pages deploy step).

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /site/dist /usr/share/nginx/html
EXPOSE 8080
