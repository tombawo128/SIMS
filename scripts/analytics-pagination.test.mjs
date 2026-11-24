import assert from 'node:assert/strict';
import test from 'node:test';
import { queryAll } from './analytics-pagination.mjs';

test('queryAll traverses more than the Supabase 1000-row cap', async () => {
  const rows = Array.from({ length: 2505 }, (_, id) => ({ id }));
  const ranges = [];
  const fakeRequest = async (path, token, options) => {
    assert.equal(path, 'rows');
    assert.equal(token, 'fixture-token');
    const range = options.headers.Range;
    ranges.push(range);
    const [start, end] = range.split('-').map(Number);
    return rows.slice(start, end + 1);
  };

  const result = await queryAll('rows', 'fixture-token', fakeRequest);
  assert.equal(result.length, 2505);
  assert.deepEqual(result, rows);
  assert.deepEqual(ranges, ['0-999', '1000-1999', '2000-2999']);
});

test('queryAll requests a terminal empty page for an exact page-size boundary', async () => {
  const rows = Array.from({ length: 1000 }, (_, id) => ({ id }));
  const ranges = [];
  const fakeRequest = async (_path, _token, options) => {
    const range = options.headers.Range;
    ranges.push(range);
    const [start, end] = range.split('-').map(Number);
    return rows.slice(start, end + 1);
  };

  const result = await queryAll('rows', 'fixture-token', fakeRequest);
  assert.equal(result.length, 1000);
  assert.deepEqual(ranges, ['0-999', '1000-1999']);
});

test('queryAll rejects a non-array page', async () => {
  await assert.rejects(queryAll('rows', 'fixture-token', async () => ({ rows: [] })), /did not return an array/);
});

test('queryAll rejects an invalid page size', async () => {
  await assert.rejects(queryAll('rows', 'fixture-token', async () => [], 0), /positive integer/);
});
