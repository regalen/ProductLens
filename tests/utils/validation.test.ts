import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  validateRole,
  validateWorkflowName,
  validatePipelineSteps,
} from '../../server/utils/validation.js';

describe('validatePassword', () => {
  it('rejects an empty string', () => {
    expect(validatePassword('')).not.toBeNull();
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(validatePassword('short')).not.toBeNull();
  });

  it('rejects exactly 7 characters', () => {
    expect(validatePassword('1234567')).not.toBeNull();
  });

  it('accepts a password of 8 or more characters', () => {
    expect(validatePassword('password123')).toBeNull();
  });

  it('accepts exactly 8 characters', () => {
    expect(validatePassword('12345678')).toBeNull();
  });
});

describe('validateRole', () => {
  it('rejects "superadmin"', () => {
    expect(validateRole('superadmin')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(validateRole('')).toBe(false);
  });

  it('accepts "user"', () => {
    expect(validateRole('user')).toBe(true);
  });

  it('accepts "pipeline_editor"', () => {
    expect(validateRole('pipeline_editor')).toBe(true);
  });

  it('accepts "admin"', () => {
    expect(validateRole('admin')).toBe(true);
  });
});

describe('validateWorkflowName', () => {
  it('rejects an empty string', () => {
    expect(validateWorkflowName('')).not.toBeNull();
  });

  it('rejects a whitespace-only string', () => {
    expect(validateWorkflowName('   ')).not.toBeNull();
  });

  it('rejects a name longer than 200 characters', () => {
    const longName = 'a'.repeat(201);
    expect(validateWorkflowName(longName)).not.toBeNull();
  });

  it('accepts exactly 200 characters', () => {
    const maxName = 'a'.repeat(200);
    expect(validateWorkflowName(maxName)).toBeNull();
  });

  it('accepts "My Workflow"', () => {
    expect(validateWorkflowName('My Workflow')).toBeNull();
  });
});

describe('validatePipelineSteps', () => {
  it('rejects an empty array', () => {
    expect(validatePipelineSteps([])).not.toBeNull();
  });

  it('rejects a non-array value (string)', () => {
    expect(validatePipelineSteps('not an array')).not.toBeNull();
  });

  it('rejects a non-array value (null)', () => {
    expect(validatePipelineSteps(null)).not.toBeNull();
  });

  it('rejects an array with an invalid step type', () => {
    expect(validatePipelineSteps([{ type: 'invalid_type' }])).not.toBeNull();
  });

  it('rejects an array with a step missing the type field', () => {
    expect(validatePipelineSteps([{}])).not.toBeNull();
  });

  it('accepts a valid array with known step types', () => {
    expect(
      validatePipelineSteps([{ type: 'resize_canvas' }, { type: 'convert' }])
    ).toBeNull();
  });

  it('accepts all known step types', () => {
    const steps = [
      { type: 'resize_canvas' },
      { type: 'crop_content' },
      { type: 'convert' },
      { type: 'scale_image' },
      { type: 'rename' },
    ];
    expect(validatePipelineSteps(steps)).toBeNull();
  });
});
