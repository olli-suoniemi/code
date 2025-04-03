# Use the official Flyway image as the base
FROM flyway/flyway:11

# Copy a custom script to handle secrets and run Flyway
COPY entrypoint.sh /flyway/entrypoint.sh

# Ensure the script is executable
RUN chmod +x /flyway/entrypoint.sh

COPY ./sql /flyway/sql

# Override the entrypoint to use the custom script
ENTRYPOINT ["/flyway/entrypoint.sh"]
