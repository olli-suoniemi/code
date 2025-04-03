<script>
  import { userUuid } from "../stores/stores.js"; // Import userUuid store
</script>

<nav class="p-4 mb-4 shadow flex justify-between items-center bg-blue-500">
  <span class="text-2xl text-white font-serif">Hello, {$userUuid}!</span>

  <div class="flex space-x-4">
    <!-- Navigation Links -->
    <a href="/" class="text-white text-lg hover:underline">Home</a>
    <a href="/submissions" class="text-white text-lg hover:underline">All submissions</a>
  </div>
</nav>
