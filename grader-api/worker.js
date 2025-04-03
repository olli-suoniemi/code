import { createClient } from 'redis';
import { grade } from './services/gradingService.js';
import { getPendingSubmissionsOlderThan, updateSubmissionStatus, getTestCodeForAssignment } from './services/assignmentService.js';
import { randomUUID } from 'crypto'; 
import dotenv from 'dotenv';
dotenv.config();

const SERVER_ID = `grader-${randomUUID()}`;

const redisClient = createClient({ url: 'redis://redis:6379', pingInterval: 1000 });

await redisClient.connect();

const redisSubscriber = redisClient.duplicate();
const redisPublisher = redisClient.duplicate();

await redisSubscriber.connect();
await redisPublisher.connect();

try {
  await redisSubscriber.xGroupCreate('submissions_stream', 'grader_group', '$', { MKSTREAM: true });
  console.log('Consumer group created or already exists');
} catch (err) {
  if (!err.message.includes('BUSYGROUP')) throw err;
}

async function flushCacheExceptStream() {
  try {
    // Get all cache keys
    const cacheKeys = await redisClient.keys('*');
    console.log('Cache keys before flush:', cacheKeys);

    // Loop through cache keys and delete keys except 'submissions_stream'
    for (const key of cacheKeys) {
      if (key !== 'submissions_stream') {
        await redisClient.del(key);
      }
    }

    console.log('Cache flush completed, remaining keys:', await redisClient.keys('*'));
  } catch (error) {
    console.error("Error during cache flush:", error.message || error);
  }
}

async function processSubmissions() {
  while (true) {
    try {
      const result = await redisSubscriber.xReadGroup('grader_group', SERVER_ID, {
        key: 'submissions_stream',
        id: '>', 
        count: 1,
        block: 5000 
      });
      
      if (result && result.length > 0) {
        const [streamData] = result;
        const { messages } = streamData;

        for (const { id, message } of messages) {

          const { userID, programmingAssignmentID, code, testCode, submissionID } = message;

          console.log(`Processing submission ${id} for user ${userID}`);

          const gradingResult = grade(code, testCode);

          const correct = gradingResult.includes('OK');
          const graderFeedback = gradingResult === '' 
            ? 'No feedback from grader. That means your code has an infinite loop' 
            : gradingResult;

          // Update the submission status
          await updateSubmissionStatus({
            status: 'processed',
            graderFeedback,
            correct,
            id: submissionID
          });

          // Flush the cache but remain submissions_stream
          await flushCacheExceptStream();

          // Notify the user via Redis that the submission has been processed
          const resultChannel = `grading_result_${userID}`;
          const publishResult = await redisPublisher.publish(resultChannel, JSON.stringify({
            id: submissionID,
            programmingAssignmentID,
            graderFeedback,
            correct,
            status: 'processed',
            code,
            userID
          }));

          console.log(`Published grading result to ${resultChannel}, Number of clients received: ${publishResult}`);

          // Notify admin via Redis that a submission has been processed
          const adminChannel = 'admin_updates';
          await redisPublisher.publish(adminChannel, JSON.stringify({
            id: submissionID,
            programmingAssignmentID,
            graderFeedback,
            correct,
            status: 'processed',
            code,
            userID,
            type: 'submission'
          }));

          console.log(`Published grading result to ${adminChannel}`);

          await redisSubscriber.xAck('submissions_stream', 'grader_group', id);
        }
      }
    } catch (error) {
      console.error('Error processing submission from stream:', error.message || error);
      if (error.message.includes('NOGROUP')) {
        console.log('Recreating consumer group...');
        try {
          await redisSubscriber.xGroupCreate('submissions_stream', 'grader_group', '$', { MKSTREAM: true });
        } catch (groupError) {
          if (!groupError.message.includes('BUSYGROUP')) {
            console.error('Failed to recreate consumer group:', groupError);
          }
        }
      }
    }
  }
}

const processPendingSubmissions = async () => {
  const pendingSubmissions = await getPendingSubmissionsOlderThan(1);

  if (pendingSubmissions.length > 0) {
    for (const submission of pendingSubmissions) {

      // Destruct to variables
      const { id, user_uuid, programming_assignment_id, code } = submission;

      try {
        // Get test code
        const res = await getTestCodeForAssignment(programming_assignment_id)
        const testCode = res[0].test_code
  
        console.log(`Re-processing submission ${id} for user ${user_uuid}`);
  
        // Re-grade the submission
        const gradingResult = grade(code, testCode);

        const correct = gradingResult.includes('OK');
        const graderFeedback = gradingResult === '' 
          ? 'No feedback from grader. That means your code has an infinite loop' 
          : gradingResult;
  
        // Update the submission status
        await updateSubmissionStatus({
          status: 'processed',
          graderFeedback,
          correct,
          id,
        });

        // Flush the cache but remain submissions_stream
        await flushCacheExceptStream();
  
        // Notify the user via Redis that the submission has been reprocessed
        const resultChannel = `grading_result_${user_uuid}`;
        await redisPublisher.publish(resultChannel, JSON.stringify({
          id,
          programming_assignment_id,
          graderFeedback,
          correct,
          status: 'processed',
          code,
          user_uuid,
        }));

        // Notify admin via Redis that a submission has been reprocessed
        const adminChannel = 'admin_updates';
        await redisPublisher.publish(adminChannel, JSON.stringify({
          id,
          programming_assignment_id,
          graderFeedback,
          correct,
          status: 'processed',
          code,
          user_uuid,
          type: 'reprocessed'
        }));
  
        console.log(`Re-processed and published result for submission ${id}`);
      } catch (error) {
        console.error(`Failed to process pending submission for assignment with ID ${programming_assignment_id}. Error: ${error}`)
      }
    }
  } else {
    console.log('No pending submissions.');
  }
};

processSubmissions();

const time = 1 * 10 * 1000;

setInterval(async () => {
  console.log('Checking for pending submissions...');
  await processPendingSubmissions();
}, time);

console.log(`${SERVER_ID} is running and waiting for submissions...`);
