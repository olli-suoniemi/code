<script>
  import { onMount, onDestroy } from 'svelte';

  // const apiDomain = "https://api.localhost";
  // const wsDomain = "wss://ws.localhost/ws";

  const apiDomain = "https://challenges.olli.codes/api";
  const wsDomain = "wss://challenges.olli.codes/ws";

  let submissions = [];
  let socket;
  let page = 1;
  let limit = 50; // Number of submissions per page
  let isLoading = true;
  let isLoadingMore = false; // Separate flag for loading more
  let error = null;

  // Fetch submissions with pagination
  const fetchSubmissions = async (newPage = 1) => {
    // Separate loading flags for initial and paginated requests
    const isInitialLoad = newPage === 1;
    if (isInitialLoad) {
      isLoading = true;
    } else {
      if (isLoadingMore) return; // Prevent duplicate requests for loading more
      isLoadingMore = true;
    }
    
    try {
      const response = await fetch(`${apiDomain}/submissions?page=${newPage}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch submissions.');
      }

      const data = await response.json();

      // Debugging: Log the entire response data
      console.log('API Response:', data);

      if (Array.isArray(data)) {
        // For pagination, append new submissions if not the first page
        submissions = newPage === 1 ? data : [...submissions, ...data];
        page = newPage;
      } else {
        throw new Error('Expected an array but got something else.');
      }

    } catch (err) {
      error = err.message;
      console.error('Error fetching submissions:', err);
    } finally {
      if (isInitialLoad) {
        isLoading = false;
      } else {
        isLoadingMore = false;
      }
    }
  };

  const loadMore = () => {
    fetchSubmissions(page + 1); // Load the next page
  };

  // Set up WebSocket connection for admin page
  const setupWebSocket = () => {
    socket = new WebSocket(`${wsDomain}/admin_updates`);

    socket.onopen = () => {
      console.log("WebSocket connection opened for admin");
      isLoading = false; // Set loading state to false when WebSocket is opened
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Transform data to the desired format
      const transformedData = {
        code: data.code,
        correct: data.correct,
        grader_feedback: data.graderFeedback,
        id: Number(data.id), // Convert id to number
        programming_assignment_id: Number(data.programmingAssignmentID), // Convert to number
        status: data.status,
        user_uuid: data.userID
      };

      // Handle incoming messages for new or updated submissions
      const existingSubmissionIndex = submissions.findIndex(sub => sub.id) === transformedData.id

      if (existingSubmissionIndex !== -1) {
        // Update the existing submission
        submissions = submissions.map(sub => 
          sub.id === transformedData.id ? { ...sub, ...transformedData } : sub
        )} 
      else {
        // Add the new submission to the list
        submissions = [transformedData, ...submissions];
      }
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
      isLoading = false;
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      isLoading = false;
    };
  };

  onMount(() => {
    setupWebSocket(); // Set up WebSocket when component mounts
    fetchSubmissions(); // Fetch initial submissions when component mounts
  });

  onDestroy(() => {
    if (socket) {
      socket.close();
    }
  });
</script>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold mb-4">All submissions</h1>

  {#if error}
    <p class="text-red-500">{error}</p>
  {:else if isLoading && submissions.length === 0}
    <div class="mt-4 flex justify-center">
      <div class="spinner"></div> <!-- Loading spinner -->
      <p class="ml-2">Loading submissions...</p>
    </div>
  {/if}

  {#if submissions.length === 0 && !isLoading}
    <p>No submissions found.</p>
  {:else}
    <div class="space-y-4">
      {#each submissions as submission}
        <div class="border border-gray-200 p-4 rounded-md shadow bg-gray-100">
          <p class="text-lg font-semibold">User ID: {submission.user_uuid}</p>
          <p class="text-sm font-medium">Code:</p>
          <pre class="bg-gray-200 p-2 rounded">{submission.code}</pre>
          <p class="text-sm font-medium">Correct: {submission.correct ? "Yes" : "No"}</p>
          <p class="text-sm font-medium">Feedback: {submission.grader_feedback || "No feedback"}</p>
          <p class="text-sm font-medium">Submitted: {new Date(submission.last_updated).toLocaleString()}</p>
        </div>
      {/each}
    </div>

    <!-- Load More Button -->
    {#if !isLoading && !isLoadingMore}
      <button
        class="mt-4 bg-blue-500 text-white py-2 px-4 rounded"
        on:click={loadMore}
      >
        {isLoadingMore ? "Loading..." : "Load More"}
      </button>
    {/if}
  {/if}
</div>

<style>
  .spinner {
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: #000;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
