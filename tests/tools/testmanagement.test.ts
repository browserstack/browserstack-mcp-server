import { createProjectOrFolderTool } from '../../src/tools/testmanagement';
import { createProjectOrFolder } from '../../src/tools/testmanagement-utils/create-project-folder';
import { createTestCaseTool , createTestRunTool} from '../../src/tools/testmanagement';
import { createTestCase, sanitizeArgs, TestCaseCreateRequest } from '../../src/tools/testmanagement-utils/create-testcase';
import axios from 'axios';
import { listTestCases } from '../../src/tools/testmanagement-utils/list-testcases';
import { createTestRun } from '../../src/tools/testmanagement-utils/create-testrun';


// Mock dependencies
jest.mock('../../src/tools/testmanagement-utils/create-project-folder', () => ({
  createProjectOrFolder: jest.fn(),
  CreateProjFoldSchema: {
    parse: (args: any) => args,
    shape: {},
  },
}));
jest.mock('../../src/tools/testmanagement-utils/create-testcase', () => ({
  createTestCase: jest.fn(),
  sanitizeArgs: jest.fn((args) => args),
}));
jest.mock('../../src/config', () => ({
  __esModule: true,
  default: {
    browserstackUsername: 'fake-user',
    browserstackAccessKey: 'fake-key',
  },
}));
jest.mock('../../src/tools/testmanagement-utils/create-testrun', () => ({
  createTestRun: jest.fn(),
  // if you’re parsing args the same way as in the others, you can include the schema mock too:
  CreateTestRunSchema: {
    parse: (args: any) => args,
    shape: {},
  },
}));
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('createTestCaseTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validArgs: TestCaseCreateRequest = {
    project_identifier: 'proj-123',
    folder_id: 'fold-456',
    name: 'Sample Test Case',
    description: 'Test case description',
    owner: 'user@example.com',
    preconditions: 'Some precondition',
    test_case_steps: [
      { step: 'Step 1', result: 'Result 1' },
      { step: 'Step 2', result: 'Result 2' },
    ],
    issues: ['JIRA-1'],
    issue_tracker: { name: 'jira', host: 'https://jira.example.com' },
    tags: ['smoke'],
    custom_fields: { priority: 'high' },
  };

  const mockCallToolResult = {
    content: [
      { type: 'text', text: 'Successfully created test case TC-001: Sample Test Case' },
      { type: 'text', text: JSON.stringify({ identifier: 'TC-001', title: 'Sample Test Case' }, null, 2) },
    ],
    isError: false,
  };

  it('should successfully create a test case', async () => {
    (createTestCase as jest.Mock).mockResolvedValue(mockCallToolResult);

    const result = await createTestCaseTool(validArgs);

    expect(sanitizeArgs).toHaveBeenCalledWith(validArgs);
    expect(createTestCase).toHaveBeenCalledWith(validArgs);
    expect(result).toBe(mockCallToolResult);
  });

  it('should handle API errors while creating test case', async () => {
    (createTestCase as jest.Mock).mockRejectedValue(new Error('API Error'));

    const result = await createTestCaseTool(validArgs);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to create test case: API Error');
  });

  it('should handle unknown error while creating test case', async () => {
    (createTestCase as jest.Mock).mockRejectedValue('unexpected');

    const result = await createTestCaseTool(validArgs);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown error');
  });
});

describe('createProjectOrFolderTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validProjectArgs = {
    project_name: 'My New Project',
    project_description: 'This is a test project',
  };

  const validFolderArgs = {
    project_identifier: 'proj-123',
    folder_name: 'My Test Folder',
    folder_description: 'This is a folder under project',
  };

  const mockProjectResponse = {
    content: [{ type: 'text', text: 'Project created with identifier=proj-123' }],
  };

  const mockFolderResponse = {
    content: [{ type: 'text', text: 'Folder created: ID=fold-123, name="My Folder" in project proj-123' }],
  };

  it('should successfully create a project', async () => {
    (createProjectOrFolder as jest.Mock).mockResolvedValue(mockProjectResponse);

    const result = await createProjectOrFolderTool(validProjectArgs);

    expect(createProjectOrFolder).toHaveBeenCalledWith(validProjectArgs);
    expect(result.content[0].text).toContain('Project created with identifier=proj-123');
  });

  it('should successfully create a folder', async () => {
    (createProjectOrFolder as jest.Mock).mockResolvedValue(mockFolderResponse);

    const result = await createProjectOrFolderTool(validFolderArgs);

    expect(createProjectOrFolder).toHaveBeenCalledWith(validFolderArgs);
    expect(result.content[0].text).toContain('Folder created: ID=fold-123');
  });

  it('should handle error while creating project or folder', async () => {
    (createProjectOrFolder as jest.Mock).mockRejectedValue(new Error('Failed to create project/folder'));

    const result = await createProjectOrFolderTool(validProjectArgs);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(
      'Failed to create project/folder: Failed to create project/folder. Please open an issue on GitHub if the problem persists'
    );
  });

  it('should handle unknown error while creating project or folder', async () => {
    (createProjectOrFolder as jest.Mock).mockRejectedValue('some unknown error');

    const result = await createProjectOrFolderTool(validProjectArgs);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(
      'Failed to create project/folder: Unknown error. Please open an issue on GitHub if the problem persists'
    );
  });
});

describe('listTestCases util', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCases = [
    { identifier: 'TC-1', title: 'Test One', case_type: 'functional', status: 'active', priority: 'high' },
    { identifier: 'TC-2', title: 'Test Two', case_type: 'regression', status: 'draft', priority: 'medium' },
  ];

  it('should return formatted summary and raw JSON on success', async () => {
    mockedAxios.get.mockResolvedValue({ data: { success: true, test_cases: mockCases, info: { count: 2 } } });

    const args = { project_identifier: 'PR-1', status: 'active', p: 1 };
    const result = await listTestCases(args as any);

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/projects/PR-1/test-cases?'),
      expect.objectContaining({ auth: expect.any(Object) })
    );
    expect(result.content[0].text).toContain('Found 2 test case(s):');
    expect(result.content[0].text).toContain('TC-1: Test One [functional | active | high]');
    expect(result.content[1].text).toBe(JSON.stringify(mockCases, null, 2));
  });

  it('should handle API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Failed to list test cases: Network Error'));

    const result = await listTestCases({ project_identifier: 'PR-1' } as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to list test cases: Network Error');
  });
});

describe('createTestRunTool', () => {                                             
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validRunArgs = {
    project_identifier: 'proj-123',
    run_name: 'Nightly Regression',
    test_cases: ['TC-001', 'TC-002'],
    environment: 'chrome',
    metadata: { os: 'macOS' },
  };

  const successRunResult = {
    content: [{ type: 'text', text: 'Successfully created test run: Run-001' }],
    isError: false,
  };

  it('should successfully create a test run', async () => {
    (createTestRun as jest.Mock).mockResolvedValue(successRunResult);

    const result = await createTestRunTool(validRunArgs as any);

    expect(createTestRun).toHaveBeenCalledWith(validRunArgs);
    expect(result).toBe(successRunResult);
  });

  it('should handle API errors while creating test run', async () => {
    (createTestRun as jest.Mock).mockRejectedValue(new Error('API Error'));

    const result = await createTestRunTool(validRunArgs as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to create test run: API Error');
  });

  it('should handle unknown error while creating test run', async () => {
    (createTestRun as jest.Mock).mockRejectedValue('unexpected');

    const result = await createTestRunTool(validRunArgs as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown error');
  });
});
