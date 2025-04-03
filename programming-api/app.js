import * as assignmentService from "./services/assignmentService.js";
import { cacheMethodCalls } from "./util/cacheUtil.js";
import { createClient } from "npm:redis@4.6.4";

// Redis Publisher Client
const publisherClient = createClient({
  url: "redis://redis:6379",
  pingInterval: 1000,
});

await publisherClient.connect();

// cache everything of assignmentService, and flush the cache when one of the methods in the list is called
const cachedAssignmentService = cacheMethodCalls(assignmentService, ["addSubmission", "deleteSubmissionById", "updateSubmissionStatus", ]);

const handlePostAssignment = async (request) => {
  const requestData = await request.json();
  const userID = requestData["user"]
  const submittedCode = requestData["code"]
  const testCode = requestData["testCode"]
  const programmingAssignmentID = requestData["id"]
  
  const data = {
    testCode: testCode,
    code: submittedCode,
    userID, 
    programmingAssignmentID
  };

  // Check if there's already a submission in grading for this user
  const pendingSubmission = Response.json(await cachedAssignmentService.getPendingSubmission(userID));
  const pendingSubmissionJson = await pendingSubmission.json()

  // Convert to number as the type of the return value from assignmentService is a string
  if (Number(pendingSubmissionJson) > 0) {
    return new Response(JSON.stringify({ error: "You already have a submission in grading." }), { status: 403 });
  }

  // Check if there is already a matcing submission by the user

  // If yes -> Do not send the submission to the grader, just send it to the database but copy the values for 
  // submission_status, grader_feedback, and correct from the matching submission

  // Else -> Send the submission to the grader and add to the database

  const oldSubmissions = Response.json(await cachedAssignmentService.getSubmissionsByUser(userID));
  const oldSubmissionsJson = await oldSubmissions.json();

  const matchingSubmission = oldSubmissionsJson.find(submission => 
    submission.programming_assignment_id === programmingAssignmentID && 
    submission.code === submittedCode
  );

  if (matchingSubmission) {
    console.log("Matching existing submission was found.")
    // There is already a matching submission so we update only the lastUpdated field
    
    // Copy status, feedback and correct from existing submission.
    // So basically we only update the lastUpdated field to the database
    const submissionData = {
      status: 'processed',
      graderFeedback: matchingSubmission.grader_feedback,
      correct: matchingSubmission.correct,
      id: matchingSubmission.id,
      programmingAssignmentID
    }
    
    console.log(`Updating existing submission with ID ${matchingSubmission.id} to the database...`)
    await cachedAssignmentService.updateSubmissionStatus(submissionData);

    // Publish the existing result to Redis using the publisher client
    try {
      const resultChannel = `grading_result_${userID}`;
      const publishResult = await publisherClient.publish(resultChannel, JSON.stringify(submissionData));
    
      console.log(`Published existing grading result of ID ${matchingSubmission.id} to ${resultChannel}, Number of clients received: ${publishResult}`);    
      
      // Return the ID of the updated submission
      return Response.json(matchingSubmission.id)  

    } catch (publishError) {
      console.error("Error publishing to Redis:", publishError.message || publishError);
    }
  } else {
    // The result will be handled asynchronously by the grader worker
    const submissionData = {
      programmingAssignmentID,
      code: submittedCode,
      userID,
      gradingStatus: 'pending', // Mark as processing
      graderFeedback: 'Submission is waiting to be graded...',
      correct: false,
      lastUpdated: new Date()
    };

    console.log(`Adding a new submission of user ${userID} to the database.`)
    // Add the submission to the database
    const result = await cachedAssignmentService.addSubmission(submissionData)

    if (result && result.length > 0) {

      console.log("Addition to the database was succesfull.")
      const idOfTheSubmission = result[0].id
      
      data.id = idOfTheSubmission
      try {
        // Add the submission to Redis Stream 'submissions_stream' to wait for the grading
        await publisherClient.xAdd('submissions_stream', '*', {
          userID: String(data.userID),
          programmingAssignmentID: String(data.programmingAssignmentID),
          code: String(data.code),
          testCode: String(data.testCode),
          submissionID: String(data.id)
        });
        
        // Return the ID of the created submission
        return Response.json(idOfTheSubmission);
      } catch (error) {
        console.error(`Failed to add submission to stream: ${error.message}`);
      }
    }
    else {
      console.error("No submission ID returned.");
    }
  }
};

const handleGetNextAssignment = async (request) => {
  const requestData = await request.json();
  const userID = requestData["user"]

  // Get assignment based on userID
  const response = Response.json(await cachedAssignmentService.getNextAssignment(userID));
  
  return response;
};

const handleGetSubmissionsOfUser = async (request) => {
  const requestData = await request.json();
  const userID = requestData["user"]
  
  // Get submissions based on userID
  const response = Response.json(await cachedAssignmentService.getSubmissionsByUser(userID));
  
  return response;
};

const handleGetPoints = async (request) => {
  const requestData = await request.json();
  const userID = requestData["user"]

  // Get correct submissions based on userID
  const response = Response.json(await cachedAssignmentService.getCorrectSubmissions(userID));

  return response;
}

const handleGetSubmissionStatus = async (request, { pathname }) => {
  const submissionId = pathname.groups.id;
  
  // Fetch submission status by ID from the database
  const submissionStatus = await cachedAssignmentService.getSubmissionStatusById(submissionId);
  
  if (submissionStatus) {
    return new Response(JSON.stringify(submissionStatus), { status: 200 });
  } else {
    return new Response("Submission not found", { status: 404 });
  }
};

const handleDeleteSubmission = async (request, { pathname }) => {
  const submissionId = pathname.groups.id;
  const { user } = await request.json(); // Extract the user ID from the request body

  // Fetch the submission by ID
  const submission = await cachedAssignmentService.getSubmissionById(submissionId);

  if (!submission) {
      return new Response("Submission not found", { status: 404 });
  }

  // Verify if the submission belongs to the user making the request
  if (submission[0].user_uuid !== user) {
      return new Response("You are not authorized to delete this submission.", { status: 403 });
  }

  const mostRecentSubmission = await cachedAssignmentService.getMostRecentSubmissionForUser(user);

  // Check if the submission being deleted is the most recent one
  if (String(mostRecentSubmission[0].id) !== String(submissionId)) {
      return new Response("You can only delete your most recent submission.", { status: 403 });
  }

  // Proceed to delete the submission
  const deletionSuccess = await cachedAssignmentService.deleteSubmissionById(submissionId);

  if (deletionSuccess) {
    return new Response("Submission deleted successfully", { status: 200 });
  } else {
    return new Response("Submission not found", { status: 404 });
  }
};

const handleGetSubmissions = async (request) => {
  try {
    // Get query parameters from the request URL
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1; // Default to page 1
    const limit = parseInt(url.searchParams.get('limit')) || 50; // Default to 50 submissions per page

    // Calculate offset
    const offset = (page - 1) * limit;

    // Fetch paginated submissions from the service
    const submissions = await cachedAssignmentService.getSubmissions(limit, offset);

    // Return the paginated submissions
    return Response.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return Response.error();
  }
};

const handleHealthCheck = async () => {
  // Return a simple health check response
  return new Response("OK", { status: 200 });
};


const urlMapping = [
    {
      method: "GET",
      pattern: new URLPattern({ pathname: "/health" }),
      fn: handleHealthCheck,
    },
    {
      method: "GET",
      pattern: new URLPattern({ pathname: "/submissions" }),
      fn: handleGetSubmissions,
    },
    {
      method: "POST",
      pattern: new URLPattern({ pathname: "/submissions" }),
      fn: handleGetSubmissionsOfUser,
    },
    {
      method: "POST",
      pattern: new URLPattern({ pathname: "/assignment" }),
      fn: handleGetNextAssignment,
    },
    {
      method: "POST",
      pattern: new URLPattern({ pathname: "/grade" }),
      fn: handlePostAssignment,
    },
    {
      method: "POST",
      pattern: new URLPattern({ pathname: "/points" }),
      fn: handleGetPoints,
    },
    {
      method: "GET",
      pattern: new URLPattern({ pathname: "/submission-status/:id" }),
      fn: handleGetSubmissionStatus,
    },
    {
      method: "DELETE",
      pattern: new URLPattern({ pathname: "/delete-submission/:id" }),
      fn: handleDeleteSubmission,
    },
];

const handleRequest = async (request) => {
  const mapping = urlMapping.find(
    (um) => um.method === request.method && um.pattern.test(request.url)
  );

  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204, // No Content
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from any origin
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (!mapping) {
    return new Response("Not found", { status: 404 });
  }

  const mappingResult = mapping.pattern.exec(request.url);
  try {
    const response = await mapping.fn(request, mappingResult);

    // Add CORS headers to every response
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (e) {
    console.error(e);
    return new Response(e.stack, { status: 500 });
  }
};

console.log("API up and running");

const portConfig = { port: 7777, hostname: '0.0.0.0' };
Deno.serve(portConfig, handleRequest);