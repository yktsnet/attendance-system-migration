# Stage 1: Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY src/Web/package*.json ./
RUN npm ci
COPY src/Web/ ./
RUN npm run build

# Stage 2: Backend build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app
COPY src/Api/*.csproj src/Api/
RUN dotnet restore src/Api/AttendanceApi.csproj
COPY src/Api/ src/Api/
RUN dotnet publish src/Api/AttendanceApi.csproj \
    -c Release -r linux-x64 --self-contained true -o out

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/out .
COPY --from=frontend-build /frontend/dist ./wwwroot
EXPOSE 8080
ENTRYPOINT ["./AttendanceApi"]
