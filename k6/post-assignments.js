import http from "k6/http";
import { crypto } from 'k6/experimental/webcrypto';

export const options = {
  duration: "10s",
  vus: 10,
};

export default function () {
  const testCode = `import socket
    def guard(*args, **kwargs):
      raise Exception("Internet is bad for you :|")
    socket.socket = guard

    import unittest
    from code import *

    class TestHello(unittest.TestCase):

      def test_hello(self):
        self.assertEqual(hello(), "Hello", "Function should return \"Hello\"")
    `
  const newSubmission = { 
    user: crypto.randomUUID().toString(),
    code: "def hello(): return 'Hello'",
    testCode: testCode,
    id: 1
  };

  http.post(
    "https://api.localhost/api/grade",
    JSON.stringify(newSubmission),
  );
}