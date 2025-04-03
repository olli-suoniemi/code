import { sql } from "../util/databaseConnect.js";

const getSubmissionsByUser = async (id) => {
  try {
    const result = await sql`
      SELECT * FROM programming_assignment_submissions WHERE user_uuid = ${id}
      ORDER BY programming_assignment_id DESC, last_updated DESC;
    `;
    return result
    
  } catch (error) {
    console.error(`Error while getting submissions by user: ${id}. Error: ${error}`)
  }
};

const getNextAssignment = async (user_uuid) => {
  const result = await getSubmissionsByUser(user_uuid)

  // if there are submission by the user
  if (result && result.length > 0) {
    // Initialize variables to track the highest ID and completion status
    let maxAssignmentId = 0;
    let completedAssignmentId = null;
    let nextAssignmentID = 1;

    // Iterate through the submissions
    result.forEach(submission => {
      // Check if the submission is correct
      if (submission.correct === true) {
        // Update the maximum assignment ID if the current submission's ID is higher
        if (submission.programming_assignment_id > maxAssignmentId) {
          maxAssignmentId = submission.programming_assignment_id;
          completedAssignmentId = submission.programming_assignment_id;
        }
      }
    });

    // If there is a completed assignment, return its ID
    if (completedAssignmentId !== null) {
      nextAssignmentID = completedAssignmentId + 1;
    } else {
      nextAssignmentID = 1;
    }

    console.log('Next assignment ID:', nextAssignmentID)

    const nextAssignment = await getAssignmentByAssignmentOrder(nextAssignmentID)
  
    if (nextAssignment && nextAssignment.length > 0 ) {
      console.log("returning existing or next assignment (some old submissions already)")
      return nextAssignment
    }
    else {
      console.log("returning null (all assignments done)")
      return null;
    }
  } else {
    // if there are not submissions, return the first assignment
    console.log("returning first assignment (no submissions yet)")
    const result = await sql`SELECT * FROM programming_assignments WHERE assignment_order = 1`
    return result
  }
};

const getAssignments = async () => {
  const result = await sql`SELECT * FROM programming_assignments;`;
  return result
};

const getAssignmentByAssignmentOrder = async (assignmentOrder) => {
  const result = await sql`SELECT * FROM programming_assignments WHERE assignment_order = ${assignmentOrder};`;
  return result
};

const addSubmission = async (submission) => {
  const {
    programmingAssignmentID,
    code,
    userID,
    gradingStatus,
    graderFeedback,
    correct,
    lastUpdated
  } = submission;

  try {
    const res = await sql`
      INSERT INTO programming_assignment_submissions (
        programming_assignment_id, code, user_uuid, status, grader_feedback, correct, last_updated
      ) VALUES (${programmingAssignmentID}, ${code}, ${userID}, ${gradingStatus}, ${graderFeedback}, ${correct}, ${lastUpdated})
       RETURNING ID
    `;
    return res
  } catch (err) {
    console.error('Error adding new submission:', err);
    throw err;
  }
}

const getCorrectSubmissions = async (id) => {
  const result = await sql`
  SELECT 
    COUNT(DISTINCT programming_assignment_id) AS correct_assignments_count
  FROM 
    programming_assignment_submissions 
  WHERE 
    user_uuid = ${id} AND 
    correct = TRUE;
  `;
  return result
};

// Method to fetch the status of a specific submission
const getSubmissionStatusById = async (submissionId) => {
  const result = await sql`
    SELECT 
      status, grader_feedback, correct, last_updated 
    FROM 
      programming_assignment_submissions 
    WHERE 
      id = ${submissionId};
  `;
  
  return result.length > 0 ? result[0] : null;
};

const deleteSubmissionById = async (submissionId, userId) => {
  console.log(`Attempting to delete submission with ID: ${submissionId}`);

  try {
    // Convert submissionId to an integer if necessary
    const result = await sql`DELETE FROM programming_assignment_submissions WHERE id = ${submissionId};`;

    console.log("DELETING....");
    console.log(`Result count: ${result.count}`);

    // Check if any rows were affected
    if (result.count > 0) {
      // Return a success response if rows were deleted
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } else {
      // Return a not found response if no rows were deleted
      return new Response(JSON.stringify({ success: false, message: "No rows found to delete" }), { status: 404 });
    }
  } catch (error) {
    console.error("Error executing DELETE query:", error);
    return new Response(JSON.stringify({ success: false, message: "Internal server error" }), { status: 500 });
  }
};

// Method to update the status of a submission
const updateSubmissionStatus = async (sumbissionData) => {
  const { status, graderFeedback, correct, id } = sumbissionData;

  try {
    const result = await sql`
      UPDATE programming_assignment_submissions 
      SET 
        status = ${status}, 
        grader_feedback = ${graderFeedback}, 
        correct = ${correct}, 
        last_updated = NOW()
      WHERE 
        id = ${id};
    `;

    console.log("Submission update result:", result.count > 0 ? 'Update successful' : 'Update failed');
  
  } catch (err) {
    console.error("Error updating submission status:", err);
    throw err;
  }
};

const getSubmissionById = async (id) => {
  try {
    const result = await sql`
      SELECT * FROM programming_assignment_submissions WHERE id = ${id};
    `;
    return result
  } catch (err) {
    console.error(`Error getting submission by ID: ${id}. Error: ${err}`);
    throw err;
  }
}

const getMostRecentSubmissionForUser = async (id) => {
  try {
    const result = await sql`
      SELECT * FROM programming_assignment_submissions WHERE user_uuid = ${id} ORDER BY last_updated DESC LIMIT 1;
    `;
    return result
  } catch (err) {
    console.error(`Error getting most recent submission for user: ${id}. Error: ${err}`);
    throw err;
  }
}

const getPendingSubmission = async (id) => {
  try {
    const result = await sql`
      SELECT * FROM programming_assignment_submissions WHERE user_uuid = ${id} AND status = 'pending';
    `;
    return result.count
  } catch (err) {
    console.error(`Error getting existing pending submission for user: ${id}. Error: ${err}`);
    throw err;
  }
}

const getSubmissions = async (limit, offset) => {
  try {
    const result = await sql`
      SELECT * FROM programming_assignment_submissions
      ORDER BY last_updated DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return result;
  } catch (err) {
    console.error(`Error getting paginated submissions. Error: ${err}`);
    throw err;
  }
};



export {
  getNextAssignment,
  getAssignments,
  addSubmission,
  getSubmissionsByUser,
  getCorrectSubmissions,
  getSubmissionStatusById,
  deleteSubmissionById,
  updateSubmissionStatus,
  getSubmissionById,
  getMostRecentSubmissionForUser,
  getPendingSubmission,
  getSubmissions
};