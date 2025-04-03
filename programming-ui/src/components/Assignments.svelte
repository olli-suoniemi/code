<script>
  import { userUuid, userPoints } from "../stores/stores.js";
  import { onMount, onDestroy } from 'svelte';

  // const apiDomain = "https://api.localhost";
  // const wsDomain = "wss://ws.localhost/ws";

  const apiDomain = "https://challenges.olli.codes/api";
  const wsDomain = "wss://challenges.olli.codes/ws";

  let submission = "";
  let submissions = [];
  let showSubmissions = false;
  let isLoading = false;

  // WebSocket connection
  let ws;

  const setupWebSocket = () => {
    const wsUrl = `${wsDomain}/?userID=${$userUuid}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connection opened for single user");
    };

    ws.onmessage = (event) => {
      getSubmissions();
      submission = "";
      showSubmissions = true
      
      const data = JSON.parse(event.data);
      console.log("Received message from WebSocket");

      console.log("Correct", data.correct)

      // Check if the submission is already in the list
      const existingSubmissionIndex = submissions.findIndex(sub => sub.id === data.id);

      console.log("existingSubmissionIndex", existingSubmissionIndex)

      if (existingSubmissionIndex !== -1) {
        // Update the existing submission
        submissions = submissions.map(sub => 
          sub.id === data.id ? { ...sub, ...data } : sub
        );
      } else {
        // Add the new submission to the list
        submissions = [...submissions, data];
      }
      
      console.log("received submission", data)
      console.log("submissions", submissions)
      
      isLoading = false; // Set loading state to false

      if (data.correct) {
        userPoints.update(points => points + 100);

        // Get a new assignment to replace the completed one.
        assignmentPromise = getAssignment()
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  };

  // Cleanup WebSocket connection on component destroy
  onDestroy(() => {
    if (ws) {
      ws.close();
    }
  });

  const getUserPoints = async () => {
    const response = await fetch(`${apiDomain}/points`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user: $userUuid }),
    });
    const pointsData = await response.json();
    userPoints.set(pointsData[0].correct_assignments_count * 100);
  };

  onMount(() => {
    getUserPoints();
    setupWebSocket(); // Set up WebSocket when component mounts
    getSubmissions();
  });

  const getAssignment = async () => {
    const response = await fetch(`${apiDomain}/assignment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({user: $userUuid}),
    });
    return await response.json();
  };

  let assignmentPromise = getAssignment();

  const getSubmissions = async () => {
    const response = await fetch(`${apiDomain}/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user: $userUuid }),
    });
    submissions = await response.json();
  };

  const addSubmission = async () => {
    console.log("Adding submission...", submission)
    if (submission.length == 0) {
        return;
    }
    
    // Await the assignmentPromise to get the resolved value
    const assignment = await assignmentPromise;

    if (!assignment) {  // There is no assignment -> all assignments are already done
      alert("You have done all the assignments")
      submission = "";
      return;
    }

    // After submission, update UI to reflect that grading is in progress
    isLoading = true; // Set loading state to true

    const newSubmission = { 
      user: $userUuid,
      code: submission,
      testCode: assignment[0].test_code,
      id: assignment[0].id
    };

    try {
      // send the submission to the grader and receive ID of the created submission as a response
      const response = await fetch(`${apiDomain}/grade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSubmission),
      });

      // Check if the response status is not 2xx (success)
      if (!response.ok) {
        isLoading = false;
        const errorData = await response.json(); // Parse the error response body
        console.error("Error:", errorData.error);

        if (response.status === 403) {
          alert(errorData.error); // Alert the user with the error message
        } else {
          alert("An error occurred: " + errorData.error);
        }

        // Stop further processing as the request was not successful
        return;
      }

      // If the response was successful, continue business as usual
      const result = await response.json()

      // Check that if the result is not number. If not we have
      // some kind of error in the API or the submission wasn't recognized.
      if (isNaN(result)) { 
        console.error("No ID was returned from API") 
      }
    } catch (error) {
      console.log(error)
    }
  };

  const toggleShowSubmissions = async () => {
    showSubmissions = !showSubmissions;
    if (showSubmissions) {
      getSubmissions();
      console.log(submissions);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0'); // Ensure two digits
    const minutes = String(date.getMinutes()).padStart(2, '0'); // Ensure two digits
    const seconds = String(date.getSeconds()).padStart(2, '0'); // Ensure two digits
    const day = String(date.getDate()).padStart(2, '0'); // Ensure two digits
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Ensure two digits
    const year = date.getFullYear();

    const formattedDate = `${hours}:${minutes}:${seconds} ${day}-${month}-${year}`;
    return formattedDate;
  };

  const formatGraderFeedback = (feedback) => {
    // Split feedback into lines
    const lines = feedback.split('\n');
    // Format each line with a bullet point
    const formattedFeedback = lines.map(line => `${line}`).join('\n');
    return formattedFeedback;
  };

  const deleteSubmission = async (submissionId) => {
    const confirmed = confirm("Are you sure you want to delete this submission?");
    if (!confirmed) return;

    const response = await fetch(`${apiDomain}/api/delete-submission/${submissionId}`, {
      method: "DELETE",
      body: JSON.stringify({ user: $userUuid }),
    });

    if (response.ok) {
      // Find the submission details
      const submission = submissions.find(sub => sub.id == submissionId)

      // Dedudct 100 points from the user if the deleted submission was correct
      if (submission.correct) {
        userPoints.update(points => points - 100);

        // Get a new assignment to replace the deleted one.
        // Basically this should return the user the previous assignment he did or null if there isn't any previous ones
        assignmentPromise = getAssignment()
      }
      
      // Remove the deleted submission from the local submissions list
      submissions = submissions.filter(sub => sub.id !== submissionId);
    } else if (response.status === 403) {
      alert("You can only delete your most recent submission.");
    } else {
      alert("Failed to delete submission. Please try again.");
    }
  };
</script>

<style>
  /* Add some styling for the loading spinner */
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

  .disabled-grading-button {
    background-color: #cbd5e0;
    cursor: not-allowed;
  }
</style>

<div class="container mx-auto px-4 py-8">
  <div class="bg-blue-500 text-white py-2 px-4 rounded mb-4">
    <h1 class="font-bold text-2xl">Exercise points</h1>
    <p>Points: {$userPoints}</p>
  </div>

  <h1 class="font-extrabold text-3xl mb-4">Assignment</h1>

  {#await assignmentPromise}
    <p>Loading...</p>
  {:then assignments}
    {#if assignments === null}
      <p>All assignments done</p>
    {:else}
      <div class="space-y-4">
        {#each assignments as assignment}
          <div class="border border-gray-200 p-4 rounded-md shadow">
            <p class="text-lg font-semibold">{assignment.title}</p>
            <p>{assignment.handout}</p>
          </div>
        {/each}
      </div>
    {/if}
  {:catch error}
    <p class="text-red-500">Error: {error.message}</p>
  {/await}

  <div class="mt-8">
    <textarea 
      type="text" 
      bind:value={submission} 
      class="w-full h-32 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:border-blue-500 resize-y"
      placeholder="Write your submission here" 
    />
  </div>

  <div class="mt-4">
    <button
      class={`font-bold py-2 px-4 rounded ${isLoading ? 'disabled-grading-button' : 'bg-blue-500 hover:bg-blue-700 text-white'}`}
      on:click={addSubmission}
      disabled={isLoading}
    >
      Send Submission
    </button>

    <button
      class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-2"
      on:click={toggleShowSubmissions}
    >
      Show Submissions
    </button>
  </div>

  {#if isLoading}
    <div class="mt-4 flex justify-center">
      <div class="spinner"></div> <!-- Loading spinner -->
      <p class="ml-2">Grading submission...</p>
    </div>
  {/if}

  {#if showSubmissions}
  <div class="mt-8">
    <h2 class="font-extrabold text-2xl mb-4">Previous Submissions</h2>
    
    {#if submissions.length === 0}
      <p class="text-gray-500">No submissions yet</p>
    {:else}
      <div class="space-y-4">
        {#each submissions as submission, index}
          <div class="border border-gray-200 p-4 rounded-md shadow {submission.correct ? 'bg-green-100' : 'bg-red-100'}">
            <p class="text-sm font-medium">Programming Task ID: {submission.programming_assignment_id}</p>
            <p class="text-sm font-medium">Submission Code:</p>
            <pre class="bg-gray-100 p-2 rounded">{submission.code}</pre>
            <p class="text-sm font-medium">Status: {submission.status}</p>
            {#if submission.grader_feedback}
              <p class="text-sm font-medium">Grader Feedback:</p>
              <pre class="bg-gray-100 p-2 rounded">{formatGraderFeedback(submission.grader_feedback)}</pre>
            {/if}
            <p class="text-sm font-medium">Correct: {submission.correct ? 'Yes' : 'No'}</p>
            <p class="text-sm font-medium">Submitted: {formatDate(submission.last_updated)}</p>
            
            {#if index === 0} <!-- Show delete button only for the first submission -->
              <button
                class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded mt-2"
                on:click={() => deleteSubmission(submission.id)}
              >
                Delete Submission
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}


</div>

