import { describe, it, expect, beforeEach } from "vitest";

// Mock Clarity environment
const mockClarity = {
  // Storage
  storage: {
    tasks: new Map(),
    submissions: new Map(),
    taskIdCounter: 0,
  },

  // Principals (addresses)
  principals: {
    employer1: "ST1EMPLOYER000000000000000000000001",
    employer2: "ST1EMPLOYER000000000000000000000002",
    worker1: "ST1WORKER0000000000000000000000001",
    worker2: "ST1WORKER0000000000000000000000002",
  },

  // STX balances
  balances: {
    ST1EMPLOYER000000000000000000000001: 1000,
    ST1EMPLOYER000000000000000000000002: 500,
    ST1WORKER0000000000000000000000001: 200,
    ST1WORKER0000000000000000000000002: 300,
    contract: 0,
  },

  // Error codes
  errors: {
    ERR_NOT_AUTHORIZED: 100,
    ERR_TASK_NOT_FOUND: 101,
    ERR_INSUFFICIENT_FUNDS: 102,
    ERR_ALREADY_SUBMITTED: 103,
    ERR_NO_SUBMISSION: 104,
    ERR_ALREADY_APPROVED: 105,
    ERR_TASK_CLOSED: 106,
  },
};

// Mock contract functions
const contract = {
  // Helper functions
  getTask: (taskId) => {
    if (!mockClarity.storage.tasks.has(taskId)) {
      return null;
    }
    return mockClarity.storage.tasks.get(taskId);
  },

  getSubmission: (taskId, worker) => {
    const key = `${taskId}-${worker}`;
    if (!mockClarity.storage.submissions.has(key)) {
      return null;
    }
    return mockClarity.storage.submissions.get(key);
  },

  getNextTaskId: () => {
    return mockClarity.storage.taskIdCounter;
  },

  // Contract functions
  postTask: (sender, description, bounty) => {
    // Check if sender has enough funds
    if (mockClarity.balances[sender] < bounty) {
      return { err: mockClarity.errors.ERR_INSUFFICIENT_FUNDS };
    }

    const taskId = mockClarity.storage.taskIdCounter;

    // Store task
    mockClarity.storage.tasks.set(taskId, {
      employer: sender,
      description,
      bounty,
      is_open: true,
      is_completed: false,
    });

    // Transfer funds to contract
    mockClarity.balances[sender] -= bounty;
    mockClarity.balances["contract"] += bounty;

    // Increment task counter
    mockClarity.storage.taskIdCounter += 1;

    return { ok: taskId };
  },

  submitProof: (sender, taskId, proof) => {
    // Check if task exists
    const task = contract.getTask(taskId);
    if (!task) {
      return { err: mockClarity.errors.ERR_TASK_NOT_FOUND };
    }

    // Check if task is open
    if (!task.is_open) {
      return { err: mockClarity.errors.ERR_TASK_CLOSED };
    }

    // Check if worker already submitted
    const submissionKey = `${taskId}-${sender}`;
    if (mockClarity.storage.submissions.has(submissionKey)) {
      return { err: mockClarity.errors.ERR_ALREADY_SUBMITTED };
    }

    // Store submission
    mockClarity.storage.submissions.set(submissionKey, {
      proof,
      timestamp: 0, // Using 0 as we removed block-height
      is_approved: false,
    });

    return { ok: true };
  },

  approveSubmission: (sender, taskId, worker) => {
    // Check if task exists
    const task = contract.getTask(taskId);
    if (!task) {
      return { err: mockClarity.errors.ERR_TASK_NOT_FOUND };
    }

    // Check if sender is the employer
    if (task.employer !== sender) {
      return { err: mockClarity.errors.ERR_NOT_AUTHORIZED };
    }

    // Check if task is open
    if (!task.is_open) {
      return { err: mockClarity.errors.ERR_TASK_CLOSED };
    }

    // Check if submission exists
    const submissionKey = `${taskId}-${worker}`;
    const submission = mockClarity.storage.submissions.get(submissionKey);
    if (!submission) {
      return { err: mockClarity.errors.ERR_NO_SUBMISSION };
    }

    // Check if submission is already approved
    if (submission.is_approved) {
      return { err: mockClarity.errors.ERR_ALREADY_APPROVED };
    }

    // Update submission
    submission.is_approved = true;
    mockClarity.storage.submissions.set(submissionKey, submission);

    // Update task
    task.is_open = false;
    task.is_completed = true;
    mockClarity.storage.tasks.set(taskId, task);

    // Transfer bounty to worker
    mockClarity.balances["contract"] -= task.bounty;
    mockClarity.balances[worker] += task.bounty;

    return { ok: true };
  },

  cancelTask: (sender, taskId) => {
    // Check if task exists
    const task = contract.getTask(taskId);
    if (!task) {
      return { err: mockClarity.errors.ERR_TASK_NOT_FOUND };
    }

    // Check if sender is the employer
    if (task.employer !== sender) {
      return { err: mockClarity.errors.ERR_NOT_AUTHORIZED };
    }

    // Check if task is open
    if (!task.is_open) {
      return { err: mockClarity.errors.ERR_TASK_CLOSED };
    }

    // Update task
    task.is_open = false;
    mockClarity.storage.tasks.set(taskId, task);

    // Return bounty to employer
    mockClarity.balances["contract"] -= task.bounty;
    mockClarity.balances[sender] += task.bounty;

    return { ok: true };
  },

  withdrawSubmission: (sender, taskId) => {
    // Check if task exists
    const task = contract.getTask(taskId);
    if (!task) {
      return { err: mockClarity.errors.ERR_TASK_NOT_FOUND };
    }

    // Check if task is open
    if (!task.is_open) {
      return { err: mockClarity.errors.ERR_TASK_CLOSED };
    }

    // Check if submission exists
    const submissionKey = `${taskId}-${sender}`;
    const submission = mockClarity.storage.submissions.get(submissionKey);
    if (!submission) {
      return { err: mockClarity.errors.ERR_NO_SUBMISSION };
    }

    // Check if submission is already approved
    if (submission.is_approved) {
      return { err: mockClarity.errors.ERR_ALREADY_APPROVED };
    }

    // Delete submission
    mockClarity.storage.submissions.delete(submissionKey);

    return { ok: true };
  },
};

// Test suite
describe("Job Bounty Board Contract", () => {
  // Reset state before each test
  beforeEach(() => {
    mockClarity.storage.tasks.clear();
    mockClarity.storage.submissions.clear();
    mockClarity.storage.taskIdCounter = 0;
    mockClarity.balances = {
      ST1EMPLOYER000000000000000000000001: 1000,
      ST1EMPLOYER000000000000000000000002: 500,
      ST1WORKER0000000000000000000000001: 200,
      ST1WORKER0000000000000000000000002: 300,
      contract: 0,
    };
  });

  describe("post-task", () => {
    it("should create a new task with bounty", () => {
      const result = contract.postTask(
        mockClarity.principals.employer1,
        "Build a website",
        100,
      );

      expect(result).toEqual({ ok: 0 });
      expect(mockClarity.storage.tasks.size).toBe(1);
      expect(mockClarity.balances[mockClarity.principals.employer1]).toBe(900);
      expect(mockClarity.balances["contract"]).toBe(100);

      const task = contract.getTask(0);
      expect(task).toEqual({
        employer: mockClarity.principals.employer1,
        description: "Build a website",
        bounty: 100,
        is_open: true,
        is_completed: false,
      });
    });

    it("should fail if employer has insufficient funds", () => {
      const result = contract.postTask(
        mockClarity.principals.employer1,
        "Build a website",
        2000,
      );

      expect(result).toEqual({
        err: mockClarity.errors.ERR_INSUFFICIENT_FUNDS,
      });
      expect(mockClarity.storage.tasks.size).toBe(0);
      expect(mockClarity.balances[mockClarity.principals.employer1]).toBe(1000);
    });

    it("should assign sequential task IDs", () => {
      contract.postTask(mockClarity.principals.employer1, "Task 1", 100);

      contract.postTask(mockClarity.principals.employer2, "Task 2", 50);

      expect(mockClarity.storage.taskIdCounter).toBe(2);
      expect(contract.getTask(0).description).toBe("Task 1");
      expect(contract.getTask(1).description).toBe("Task 2");
    });
  });

  describe("submit-proof", () => {
    beforeEach(() => {
      // Create a task first
      contract.postTask(
        mockClarity.principals.employer1,
        "Build a website",
        100,
      );
    });

    it("should allow worker to submit proof", () => {
      const result = contract.submitProof(
        mockClarity.principals.worker1,
        0,
        "https://example.com/completed-work",
      );

      expect(result).toEqual({ ok: true });

      const submission = contract.getSubmission(
        0,
        mockClarity.principals.worker1,
      );
      expect(submission).not.toBeNull();
      expect(submission.proof).toBe("https://example.com/completed-work");
      expect(submission.is_approved).toBe(false);
    });

    it("should not allow submitting to non-existent task", () => {
      const result = contract.submitProof(
        mockClarity.principals.worker1,
        999,
        "https://example.com/completed-work",
      );

      expect(result).toEqual({ err: mockClarity.errors.ERR_TASK_NOT_FOUND });
    });

    it("should not allow multiple submissions from same worker", () => {
      // First submission
      contract.submitProof(
        mockClarity.principals.worker1,
        0,
        "https://example.com/completed-work",
      );

      // Second submission
      const result = contract.submitProof(
        mockClarity.principals.worker1,
        0,
        "https://example.com/updated-work",
      );

      expect(result).toEqual({ err: mockClarity.errors.ERR_ALREADY_SUBMITTED });
    });

    it("should not allow submission to closed task", () => {
      // Cancel the task
      contract.cancelTask(mockClarity.principals.employer1, 0);

      // Try to submit
      const result = contract.submitProof(
        mockClarity.principals.worker1,
        0,
        "https://example.com/completed-work",
      );

      expect(result).toEqual({ err: mockClarity.errors.ERR_TASK_CLOSED });
    });
  });

  describe("approve-submission", () => {
    beforeEach(() => {
      // Create a task
      contract.postTask(
        mockClarity.principals.employer1,
        "Build a website",
        100,
      );

      // Submit proof
      contract.submitProof(
        mockClarity.principals.worker1,
        0,
        "https://example.com/completed-work",
      );
    });

    it("should allow employer to approve submission", () => {
      const initialWorkerBalance =
        mockClarity.balances[mockClarity.principals.worker1];

      const result = contract.approveSubmission(
        mockClarity.principals.employer1,
        0,
        mockClarity.principals.worker1,
      );

      expect(result).toEqual({ ok: true });

      // Check if task is marked as completed
      const task = contract.getTask(0);
      expect(task.is_open).toBe(false);
      expect(task.is_completed).toBe(true);

      // Check if submission is marked as approved
      const submission = contract.getSubmission(
        0,
        mockClarity.principals.worker1,
      );
      expect(submission.is_approved).toBe(true);

      // Check if bounty was transferred
      expect(mockClarity.balances[mockClarity.principals.worker1]).toBe(
        initialWorkerBalance + 100,
      );
      expect(mockClarity.balances["contract"]).toBe(0);
    });

    it("should not allow non-employer to approve", () => {
      const result = contract.approveSubmission(
        mockClarity.principals.employer2,
        0,
        mockClarity.principals.worker1,
      );

      expect(result).toEqual({ err: mockClarity.errors.ERR_NOT_AUTHORIZED });
    });

    it("should not approve non-existent submission", () => {
      const result = contract.approveSubmission(
        mockClarity.principals.employer1,
        0,
        mockClarity.principals.worker2,
      );

      expect(result).toEqual({ err: mockClarity.errors.ERR_NO_SUBMISSION });
    });

    it("should not approve already approved submission", () => {
      // First approval
      contract.approveSubmission(
        mockClarity.principals.employer1,
        0,
        mockClarity.principals.worker1,
      );

      // Second approval attempt
      const result = contract.approveSubmission(
        mockClarity.principals.employer1,
        0,
        mockClarity.principals.worker1,
      );

      expect(result).toEqual({ err: mockClarity.errors.ERR_TASK_CLOSED });
    });
  });

  describe("cancel-task", () => {
    beforeEach(() => {
      // Create a task
      contract.postTask(
        mockClarity.principals.employer1,
        "Build a website",
        100,
      );
    });

    it("should allow employer to cancel task", () => {
      const initialEmployerBalance =
        mockClarity.balances[mockClarity.principals.employer1];

      const result = contract.cancelTask(mockClarity.principals.employer1, 0);

      expect(result).toEqual({ ok: true });

      // Check if task is marked as not open
      const task = contract.getTask(0);
      expect(task.is_open).toBe(false);

      // Check if bounty was returned
      expect(mockClarity.balances[mockClarity.principals.employer1]).toBe(
        initialEmployerBalance + 100,
      );
      expect(mockClarity.balances["contract"]).toBe(0);
    });

    it("should not allow non-employer to cancel", () => {
      const result = contract.cancelTask(mockClarity.principals.worker1, 0);

      expect(result).toEqual({ err: mockClarity.errors.ERR_NOT_AUTHORIZED });
    });

    it("should not cancel non-existent task", () => {
      const result = contract.cancelTask(mockClarity.principals.employer1, 999);

      expect(result).toEqual({ err: mockClarity.errors.ERR_TASK_NOT_FOUND });
    });

    it("should not cancel already closed task", () => {
      // First cancel
      contract.cancelTask(mockClarity.principals.employer1, 0);

      // Second cancel attempt
      const result = contract.cancelTask(mockClarity.principals.employer1, 0);

      expect(result).toEqual({ err: mockClarity.errors.ERR_TASK_CLOSED });
    });
  });

  describe("withdraw-submission", () => {
    beforeEach(() => {
      // Create a task
      contract.postTask(
        mockClarity.principals.employer1,
        "Build a website",
        100,
      );

      // Submit proof
      contract.submitProof(
        mockClarity.principals.worker1,
        0,
        "https://example.com/completed-work",
      );
    });

    it("should allow worker to withdraw submission", () => {
      const result = contract.withdrawSubmission(
        mockClarity.principals.worker1,
        0,
      );

      expect(result).toEqual({ ok: true });

      // Check if submission was deleted
      const submission = contract.getSubmission(
        0,
        mockClarity.principals.worker1,
      );
      expect(submission).toBeNull();
    });

    it("should not allow withdrawal of non-existent submission", () => {
      const result = contract.withdrawSubmission(
        mockClarity.principals.worker2,
        0,
      );

      expect(result).toEqual({ err: mockClarity.errors.ERR_NO_SUBMISSION });
    });

    it("should not allow withdrawal after approval", () => {
      // Approve submission first
      contract.approveSubmission(
        mockClarity.principals.employer1,
        0,
        mockClarity.principals.worker1,
      );

      // Try to withdraw
      const result = contract.withdrawSubmission(
        mockClarity.principals.worker1,
        0,
      );

      expect(result).toEqual({ err: mockClarity.errors.ERR_TASK_CLOSED });
    });

    it("should not allow withdrawal from closed task", () => {
      // Cancel the task
      contract.cancelTask(mockClarity.principals.employer1, 0);

      // Try to withdraw
      const result = contract.withdrawSubmission(
        mockClarity.principals.worker1,
        0,
      );

      expect(result).toEqual({ err: mockClarity.errors.ERR_TASK_CLOSED });
    });
  });

  describe("read-only functions", () => {
    beforeEach(() => {
      // Create tasks
      contract.postTask(mockClarity.principals.employer1, "Task 1", 100);

      contract.postTask(mockClarity.principals.employer2, "Task 2", 50);

      // Submit proof
      contract.submitProof(
        mockClarity.principals.worker1,
        0,
        "Proof for task 1",
      );
    });

    it("should get task details", () => {
      const task = contract.getTask(0);

      expect(task).not.toBeNull();
      expect(task.employer).toBe(mockClarity.principals.employer1);
      expect(task.description).toBe("Task 1");
      expect(task.bounty).toBe(100);
      expect(task.is_open).toBe(true);
    });

    it("should return null for non-existent task", () => {
      const task = contract.getTask(999);
      expect(task).toBeNull();
    });

    it("should get submission details", () => {
      const submission = contract.getSubmission(
        0,
        mockClarity.principals.worker1,
      );

      expect(submission).not.toBeNull();
      expect(submission.proof).toBe("Proof for task 1");
      expect(submission.is_approved).toBe(false);
    });

    it("should return null for non-existent submission", () => {
      const submission = contract.getSubmission(
        0,
        mockClarity.principals.worker2,
      );
      expect(submission).toBeNull();
    });

    it("should get next task ID", () => {
      expect(contract.getNextTaskId()).toBe(2);
    });
  });
});
