# Debugging

Clear cache:

```bash
sudo npm cache clean --force
sudo rm -rf node_modules package-lock.json
npm install
```

Clear docker containers and build app:

```bash
docker system prune -a
docker compose up --build
```
