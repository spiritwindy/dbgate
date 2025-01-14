import {
  mysqlSplitterOptions,
  mssqlSplitterOptions,
  postgreSplitterOptions,
  mongoSplitterOptions,
  noSplitSplitterOptions,
} from './options';
import { splitQuery } from './splitQuery';

test('simple query', () => {
  const output = splitQuery('select * from A');
  expect(output).toEqual(['select * from A']);
});

test('correct split 2 queries', () => {
  const output = splitQuery('SELECT * FROM `table1`;SELECT * FROM `table2`;', mysqlSplitterOptions);
  expect(output).toEqual(['SELECT * FROM `table1`', 'SELECT * FROM `table2`']);
});

test('correct split 2 queries - no end semicolon', () => {
  const output = splitQuery('SELECT * FROM `table1`;SELECT * FROM `table2`', mysqlSplitterOptions);
  expect(output).toEqual(['SELECT * FROM `table1`', 'SELECT * FROM `table2`']);
});

test('delete empty query', () => {
  const output = splitQuery(';;;\n;;SELECT * FROM `table1`;;;;;SELECT * FROM `table2`;;; ;;;', mysqlSplitterOptions);
  expect(output).toEqual(['SELECT * FROM `table1`', 'SELECT * FROM `table2`']);
});

test('should handle double backtick', () => {
  const input = ['CREATE TABLE `a``b` (`c"d` INT)', 'CREATE TABLE `a````b` (`c"d` INT)'];
  const output = splitQuery(input.join(';\n') + ';', mysqlSplitterOptions);
  expect(output).toEqual(input);
});

test('semicolon inside string', () => {
  const input = ['CREATE TABLE a', "INSERT INTO a (x) VALUES ('1;2;3;4')"];
  const output = splitQuery(input.join(';\n') + ';', mysqlSplitterOptions);
  expect(output).toEqual(input);
});

test('semicolon inside identyifier - mssql', () => {
  const input = ['CREATE TABLE [a;1]', "INSERT INTO [a;1] (x) VALUES ('1')"];
  const output = splitQuery(input.join(';\n') + ';', {
    ...mssqlSplitterOptions,
    allowSemicolon: true,
  });
  expect(output).toEqual(input);
});

test('delimiter test', () => {
  const input = 'SELECT 1;\n DELIMITER $$\n SELECT 2; SELECT 3; \n DELIMITER ;';
  const output = splitQuery(input, mysqlSplitterOptions);
  expect(output).toEqual(['SELECT 1', 'SELECT 2; SELECT 3;']);
});

test('one line comment test', () => {
  const input = 'SELECT 1 -- comment1;comment2\n;SELECT 2';
  const output = splitQuery(input, mysqlSplitterOptions);
  expect(output).toEqual(['SELECT 1 -- comment1;comment2', 'SELECT 2']);
});

test('multi line comment test', () => {
  const input = 'SELECT 1 /* comment1;comment2\ncomment3*/;SELECT 2';
  const output = splitQuery(input, mysqlSplitterOptions);
  expect(output).toEqual(['SELECT 1 /* comment1;comment2\ncomment3*/', 'SELECT 2']);
});

test('dollar string', () => {
  const input = 'CREATE PROC $$ SELECT 1; SELECT 2; $$ ; SELECT 3';
  const output = splitQuery(input, postgreSplitterOptions);
  expect(output).toEqual(['CREATE PROC $$ SELECT 1; SELECT 2; $$', 'SELECT 3']);
});

test('go delimiter', () => {
  const input = 'SELECT 1\ngo\nSELECT 2';
  const output = splitQuery(input, mssqlSplitterOptions);
  expect(output).toEqual(['SELECT 1', 'SELECT 2']);
});

test('no split', () => {
  const input = 'SELECT 1;SELECT 2';
  const output = splitQuery(input, noSplitSplitterOptions);
  expect(output).toEqual(['SELECT 1;SELECT 2']);
});

test('split mongo', () => {
  const input = 'db.collection.insert({x:1});db.collection.insert({y:2})';
  const output = splitQuery(input, mongoSplitterOptions);
  expect(output).toEqual(['db.collection.insert({x:1})', 'db.collection.insert({y:2})']);
});

test('count lines', () => {
  const output = splitQuery('SELECT * FROM `table1`;\nSELECT * FROM `table2`;', {
    ...mysqlSplitterOptions,
    returnRichInfo: true,
  });
  expect(output).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: 'SELECT * FROM `table1`',

        trimStart: expect.objectContaining({
          position: 0,
          line: 0,
          column: 0,
        }),

        end: expect.objectContaining({
          position: 22,
          line: 0,
          column: 22,
        }),
      }),
      expect.objectContaining({
        text: 'SELECT * FROM `table2`',

        trimStart: expect.objectContaining({
          position: 24,
          line: 1,
          column: 0,
        }),

        end: expect.objectContaining({
          position: 46,
          line: 1,
          column: 22,
        }),
      }),
    ])
  );
});

test('count lines with flush', () => {
  const output = splitQuery('SELECT * FROM `table1`;\nSELECT * FROM `table2`', {
    ...mysqlSplitterOptions,
    returnRichInfo: true,
  });
  expect(output).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: 'SELECT * FROM `table1`',

        trimStart: expect.objectContaining({
          position: 0,
          line: 0,
          column: 0,
        }),

        end: expect.objectContaining({
          position: 22,
          line: 0,
          column: 22,
        }),
      }),
      expect.objectContaining({
        text: 'SELECT * FROM `table2`',

        trimStart: expect.objectContaining({
          position: 24,
          line: 1,
          column: 0,
        }),

        end: expect.objectContaining({
          position: 46,
          line: 1,
          column: 22,
        }),
      }),
    ])
  );
});
