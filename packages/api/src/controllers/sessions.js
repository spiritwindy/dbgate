const _ = require('lodash');
const uuidv1 = require('uuid/v1');
const connections = require('./connections');
const socket = require('../utility/socket');
const { fork } = require('child_process');
const jsldata = require('./jsldata');
const { handleProcessCommunication } = require('../utility/processComm');
const processArgs = require('../utility/processArgs');

module.exports = {
  /** @type {import('dbgate-types').OpenedSession[]} */
  opened: [],

  // handle_error(sesid, props) {
  //   const { error } = props;
  //   console.log(`Error in database session ${sesid}`, error);
  //   this.dispatchMessage(sesid, {
  //     severity: 'error',
  //     message: error && error.toString(),
  //   });
  // },

  // handle_row(sesid, props) {
  //   const { row } = props;
  //   socket.emit('sessionRow', row);
  // },
  dispatchMessage(sesid, message) {
    if (_.isString(message)) {
      socket.emit(`session-info-${sesid}`, {
        message,
        time: new Date(),
        severity: 'info',
      });
    }
    if (_.isPlainObject(message)) {
      socket.emit(`session-info-${sesid}`, {
        time: new Date(),
        severity: 'info',
        ...message,
      });
    }
  },

  handle_info(sesid, props) {
    const { info } = props;
    this.dispatchMessage(sesid, info);
  },

  handle_done(sesid) {
    socket.emit(`session-done-${sesid}`);
    this.dispatchMessage(sesid, 'Query execution finished');
  },

  handle_recordset(sesid, props) {
    const { jslid, resultIndex } = props;
    socket.emit(`session-recordset-${sesid}`, { jslid, resultIndex });
  },

  handle_stats(sesid, stats) {
    jsldata.notifyChangedStats(stats);
  },

  handle_ping() {},

  create_meta: true,
  async create({ conid, database }) {
    const sesid = uuidv1();
    const connection = await connections.get({ conid });
    const subprocess = fork(global['API_PACKAGE'] || process.argv[1], [
      '--is-forked-api',
      '--start-process',
      'sessionProcess',
      ...processArgs.getPassArgs(),
      // ...process.argv.slice(3),
    ]);
    const newOpened = {
      conid,
      database,
      subprocess,
      connection,
      sesid,
    };
    this.opened.push(newOpened);
    subprocess.on('message', message => {
      // @ts-ignore
      const { msgtype } = message;
      if (handleProcessCommunication(message, subprocess)) return;
      this[`handle_${msgtype}`](sesid, message);
    });
    subprocess.send({ msgtype: 'connect', ...connection, database });
    return _.pick(newOpened, ['conid', 'database', 'sesid']);
  },

  executeQuery_meta: true,
  async executeQuery({ sesid, sql }) {
    const session = this.opened.find(x => x.sesid == sesid);
    if (!session) {
      throw new Error('Invalid session');
    }

    console.log(`Processing query, sesid=${sesid}, sql=${sql}`);
    this.dispatchMessage(sesid, 'Query execution started');
    session.subprocess.send({ msgtype: 'executeQuery', sql });

    return { state: 'ok' };
  },

  // cancel_meta: true,
  // async cancel({ sesid }) {
  //   const session = this.opened.find((x) => x.sesid == sesid);
  //   if (!session) {
  //     throw new Error('Invalid session');
  //   }
  //   session.subprocess.send({ msgtype: 'cancel' });
  //   return { state: 'ok' };
  // },

  kill_meta: true,
  async kill({ sesid }) {
    const session = this.opened.find(x => x.sesid == sesid);
    if (!session) {
      throw new Error('Invalid session');
    }
    session.subprocess.kill();
    this.dispatchMessage(sesid, 'Connection closed');
    return { state: 'ok' };
  },

  // runCommand_meta: true,
  // async runCommand({ conid, database, sql }) {
  //   console.log(`Running SQL command , conid=${conid}, database=${database}, sql=${sql}`);
  //   const opened = await this.ensureOpened(conid, database);
  //   const res = await this.sendRequest(opened, { msgtype: 'queryData', sql });
  //   return res;
  // },
};
