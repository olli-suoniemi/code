import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';

const run = (cmdList) => {
  const cmd = cmdList.join(' ');
  execSync(cmd, { stdio: 'inherit' });
};

const createGradingContainer = (code, testCode, randomKey) => {
  const codeFileName = `submission-${randomKey}.data`;
  writeFileSync(codeFileName, code);
  const testFileName = `test-${randomKey}.data`;
  writeFileSync(testFileName, testCode);

  const graderContainerName = `submission-image-${randomKey}`;
  const tmpGraderContainerName = `${graderContainerName}-tmp`;

  run(['docker', 'create', '--name', tmpGraderContainerName, 'grader-image']);
  run(['docker', 'cp', codeFileName, `${tmpGraderContainerName}:/app/submission/code.py`]);
  run(['docker', 'cp', testFileName, `${tmpGraderContainerName}:/app/submission/test-code.py`]);
  run(['docker', 'commit', tmpGraderContainerName, graderContainerName]);
  run(['docker', 'rm', '-fv', tmpGraderContainerName]);

  unlinkSync(codeFileName);
  unlinkSync(testFileName);

  return graderContainerName;
};

const runGradingContainer = (graderContainerName, randomKey) => {
  run(['docker', 'run', '--name', `${graderContainerName}-image`, graderContainerName]);
  run(['docker', 'cp', `${graderContainerName}-image:/app/submission/result.data`, `result-${randomKey}.data`]);
  run(['docker', 'image', 'rm', '-f', graderContainerName]);
  run(['docker', 'rm', '-fv', `${graderContainerName}-image`]);

  const result = readFileSync(`result-${randomKey}.data`, 'utf8');
  unlinkSync(`result-${randomKey}.data`);
  return result.trim();
};

const grade = (code, testCode) => {
  const randomKey = Math.floor(Math.random() * 900000000 + 100000000);
  const graderContainerName = createGradingContainer(code, testCode, randomKey);
  return runGradingContainer(graderContainerName, randomKey);
};

export { grade };
