const { io } = require("socket.io-client");
const fetch = require("node-fetch");
const assert = require("assert");


describe('test websocket connectivity', () => {
  it('should connect and initiate an opponent search, then test socket connectivity', function(done) {
    console.log('Websocket test started!')
    let completed = false;

    const socket = io("http://localhost:5000/connect", {
      transports: ["websocket"],
    });

    socket.io.on("error", (error) => {
      console.log("Error " + error)
      assert.fail("error", "connect", error);
    });

    socket.on("disconnect", (reason, details) => {
      console.log("Disconnected " + reason + " " + JSON.stringify(details))
      if (!completed)
        assert.fail("disconnect", "connect", reason + " " + JSON.stringify(details));
    });

    socket.on("connect_error", (error) => {
      if (socket.active) {
        console.log("Connection error but socket active " + error.message);
        assert.fail("connect_error", "connect", error.message);
      } else {
        // the connection was denied by the server
        // in that case, `socket.connect()` must be manually called in order to reconnect
        console.log("Connection is gone " + error.message);
        assert.fail("connect_error", "connect", error.message);
      }
    });

    socket.on("connect", () => {
      console.log("Connected"); // true
      const play = { 'data': { 'preferences': { 'time_control': '30+0', } } } ;
      socket.emit("/api/play", play, (response) => {
        console.log("play api called " + response)
        setTimeout(() => {
          const json = { "data": { "sid": response, "checkin": true } };
          socket.emit("/api/heartbeat", json, (response) => {
            console.log("heartbeat api called " + JSON.stringify(response));
            assert.deepEqual(response, {"rival_connect_status":2});
            completed = true;
            socket.disconnect();
            done();
          });
        }, 8000);
      });
    });
    setTimeout(() => {
      assert.strictEqual(completed, true);
    },10000);
  });
});

