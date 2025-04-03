import { readable, writable } from "svelte/store";

// Initialize variables
let user;
let isBrowser = typeof window !== 'undefined'; // Check if code is running in the browser

if (isBrowser) {
  // Retrieve 'userUuid' from localStorage
  user = localStorage.getItem("userUuid");

  // If 'userUuid' does not exist, generate a new UUID and store it in localStorage
  if (!user) {
    user = crypto.randomUUID().toString();
    localStorage.setItem("userUuid", user);
  }
}

// Create a readable store for 'userUuid' and a writable store for 'userPoints'
export const userUuid = readable(user || ''); // Default to empty string if not in the browser
export const userPoints = writable(0);
