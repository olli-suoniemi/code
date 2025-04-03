# A coding exercise platform with automatic grader

### 🚀 [Try the app](https://challenges.olli.codes/)

This project is about demonstrating the use of different programming techniques by creating a coding platform where people can submit their code and automatic grader will assess them. There is emphasis on scalability, load balancing, message queues and event-driven architechture.

Upon opening the application, the user is presented with the name and handout of a programming assignment. The interface includes a textarea for writing a Python program to solve the problem outlined in the handout and a submit button for assessment.

After submission, the program is assessed, and the user receives updates on the grading status. If issues are found, they are displayed, allowing the user to adjust their code. If the program is correct, the user is notified of successful completion and can progress to the next assignment.

When the user reopens the application, they can continue from the first incomplete assignment.

The focus of the project is on scalability, with an emphasis on topics such as performance measurement, load balancing, caching, event-driven architecture, and message queues. Both development and production configurations are addressed.

<br>

## Architecture Overview

This application handles submissions and uses a message queue architecture with Redis for processing and caching. Below is an explanation of the key components and data flow based on the architecture diagram.

![Architecture Overview](static/Architecture.png)

### Components and Data Flow

1. **Frontend:**
   - **POST Request:** Sends a new submission (sub) to the API. 
   - **GET Request:** Retrieves cached submissions from the API.
   - **Receive Graded Sub:** The frontend receives graded results once submissions are processed.
   - **DELETE Request:** Removes a submission by sending a DELETE request via the API.
   - **WebSocket Connection:** Opens a persistent connection to receive real-time updates on submission status.

2. **API:**
   - **Submission Handling:** Receives new or updated submissions from the frontend.
   - **Caching:** Submissions are cached to improve performance. Cache is flushed when submissions are added, updated, or deleted.
   - **Database Operations:** 
     - **Add/Update Subs:** Adds new submissions or updates existing ones in the database.
     - **Delete Subs:** Deletes submissions from the database, triggering cache flush.
   - **Queue Operations:** 
     - Publishes new/updated submissions to the Redis submission queue.
     - Publishes graded results to the Redis results queue after processing.

3. **Redis Sub Queue:**
   - Buffers new or updated submissions.
   - The **Grader** subscribes to this queue to process each submission.

4. **Grader:**
   - **Grade Submission:** Subscribes to the Redis submission queue, processes submissions (grades), and updates the submission status in the database.
   - **Cache Management:** Flushes the cache after grading to maintain data consistency.
   - **Result Publishing:** Publishes the grading result to the Redis results queue.

5. **Redis Results Queue:**
   - Stores graded results from the Grader.
   - The API and WebSocket systems subscribe to this queue to retrieve results and send them to the frontend.

6. **WebSocket:**
   - Subscribes to the Redis results queue to receive graded submissions.
   - Sends real-time updates to the frontend when grading is complete.

### Caching Flow
- Caching is implemented to improve performance by storing submissions temporarily. 
- The cache is flushed whenever submissions are added, updated, or deleted to ensure the frontend receives the most up-to-date data.

### Data Flow Summary
1. A new submission is sent from the frontend to the API.
2. The API stores the submission in the database and publishes it to the Redis submission queue, flushing the cache.
3. The Grader processes the submission, grades it, and updates the database.
4. The grading result is published to the Redis results queue.
5. The API and WebSocket subscribe to the results queue and send the graded submission back to the frontend.

### Key Design Concepts
- **Message Queuing:** Redis is used for message queuing, allowing asynchronous processing of submissions and results.
- **Real-Time Updates:** WebSockets ensure the frontend receives real-time updates about submission status.
- **Caching:** Caching is employed to boost performance, with cache invalidation ensuring data consistency when the state of submissions changes.

<br>

## Deploying

Prepare VPS:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl -y
```

Copy the public ssh-key of the main user to the server:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub olli@olli.codes
```

Disallow root login and set login only possible by public key:

```bash
sudo nano /etc/ssh/sshd_config
```

Add content:

```bash
PermitRootLogin no
PubkeyAuthentication yes
PasswordAuthentication no
```

Apply with:

```bash
sshd -t
```

or

```bash
ssh -t
```

If no errors were detected when checking the configuration, the SSH service can be restarted with the following command:


```bash
systemctl restart sshd
```

or

```bash
systemctl restart ssh
```

<br>

Install [Docker](https://docs.docker.com/engine/install/ubuntu/)

On local machine. Authenticate to GHCR:

```bash
echo "<YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>" | docker login ghcr.io -u olli-suoniemi --password-stdin
```

Build & push images to GHCR:

```bash
docker build -t ghcr.io/olli-suoniemi/code-platform/grader-api:latest -f grader-api/Dockerfile grader-api/
docker build -t ghcr.io/olli-suoniemi/code-platform/grader-image:latest -f grader-image/Dockerfile grader-image/
docker build -t ghcr.io/olli-suoniemi/code-platform/programming-api:latest -f programming-api/Dockerfile.prod programming-api/
docker build -t ghcr.io/olli-suoniemi/code-platform/programming-ui:latest -f programming-ui/Dockerfile.prod programming-ui/
docker build -t ghcr.io/olli-suoniemi/code-platform/websocket:latest -f websocket/Dockerfile websocket/
docker build -t ghcr.io/olli-suoniemi/code-platform/flyway:latest -f flyway/Dockerfile flyway/
```

```bash
docker push ghcr.io/olli-suoniemi/code-platform/grader-api:latest
docker push ghcr.io/olli-suoniemi/code-platform/grader-image:latest
docker push ghcr.io/olli-suoniemi/code-platform/programming-api:latest
docker push ghcr.io/olli-suoniemi/code-platform/programming-ui:latest
docker push ghcr.io/olli-suoniemi/code-platform/websocket:latest
docker push ghcr.io/olli-suoniemi/code-platform/flyway:latest
```

Remember to set the images public in GHCR.

Copy docker-stack.yml to VPS

```bash
scp ~/Personal/Code-Platform/docker-stack.yml olli@olli.codes:/home/olli/code-platform/docker-stack.yml
```

<br>

In VPS, pull images:

```bash
docker pull ghcr.io/olli-suoniemi/code-platform/grader-api:latest
docker pull ghcr.io/olli-suoniemi/code-platform/grader-image:latest
docker pull ghcr.io/olli-suoniemi/code-platform/programming-api:latest
docker pull ghcr.io/olli-suoniemi/code-platform/programming-ui:latest
docker pull ghcr.io/olli-suoniemi/code-platform/websocket:latest
docker pull ghcr.io/olli-suoniemi/code-platform/flyway:latest
```

<br>

```ghcr.io/olli-suoniemi/code-platform/grader-image:latest``` must be tagged as ```grader-image:latest``` so the ```gradingService.js``` recognizes the image:

```bash
docker tag ghcr.io/olli-suoniemi/code-platform/grader-image:latest grader-image:latest
```

<br>

Now we can setup our node to use docker stack. We enable docker swarm mode in our node:

```bash
docker swarm init
```

Running this command, it shows you a token that could be used to allow other nodes to create a swarm cluster.
You can ignore the token, as we don't actually use docker cluster.


<br>

Our app uses multiple docker secrets instead of using .env files.

The following secrets must be created.

```bash
echo -n "/app-cache" | docker secret create DENO_DIR -
echo -n "password" | docker secret create FLYWAY_PASSWORD -
echo -n "jdbc:postgresql://database:5432/codeplatform" | docker secret create FLYWAY_URL -
echo -n "user" | docker secret create FLYWAY_USER -
echo -n "codeplatform" | docker secret create PGDATABASE -
echo -n "database" | docker secret create PGHOST -
echo -n "password" | docker secret create PGPASSWORD -
echo -n "5432" | docker secret create PGPORT -
echo -n "user" | docker secret create PGUSER -
echo -n "codeplatform" | docker secret create POSTGRES_DB -
echo -n "password" | docker secret create POSTGRES_PASSWORD -
echo -n "user" | docker secret create POSTGRES_USER -
echo -n "postgres://user:password@database:5432/codeplatform" | docker secret create DATABASE_URL -
```

See [Docker secret](https://docs.docker.com/reference/cli/docker/secret/) for creating secrets.

Stack can be deployed:

```bash
docker stack deploy -c docker-stack.yml code-platform
```

Services can be updated (latest tag makes us to pull the image manually):

```bash
docker service update --force code-platform_database
docker service update --force --with-registry-auth --image ghcr.io/olli-suoniemi/code-platform/flyway:latest code-platform_flyway  
docker service update --force --with-registry-auth --image ghcr.io/olli-suoniemi/code-platform/grader-api:latest code-platform_grader-api    
docker service update --force --with-registry-auth --image ghcr.io/olli-suoniemi/code-platform/grader-image:latest code-platform_grader-image
docker service update --force --with-registry-auth --image ghcr.io/olli-suoniemi/code-platform/programming-api:latest code-platform_programming-api
docker service update --force --with-registry-auth --image ghcr.io/olli-suoniemi/code-platform/programming-ui:latest code-platform_programming-ui    
docker service update --force code-platform_redis     
docker service update --force --with-registry-auth --image ghcr.io/olli-suoniemi/code-platform/websocket:latest code-platform_websocket 
```
