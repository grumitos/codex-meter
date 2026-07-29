import assert from "node:assert/strict";
import test from "node:test";

import { choosePrivateIpv4 } from "../src/windows-app.mjs";

test("chooses Wi-Fi LAN over CGNAT, public, and loopback addresses", () => {
  assert.equal(
    choosePrivateIpv4({
      Tailscale: [
        { address: "100.64.0.10", family: "IPv4", internal: false },
      ],
      Ethernet: [
        { address: "8.8.8.8", family: "IPv4", internal: false },
      ],
      Loopback: [
        { address: "127.0.0.1", family: "IPv4", internal: true },
      ],
      WiFi: [
        { address: "192.168.1.2", family: "IPv4", internal: false },
      ],
    }),
    "192.168.1.2",
  );
});

test("accepts every RFC 1918 range and fails without one", () => {
  assert.equal(
    choosePrivateIpv4({ Ethernet: [
      { address: "10.20.30.40", family: 4, internal: false },
    ] }),
    "10.20.30.40",
  );
  assert.equal(
    choosePrivateIpv4({ Ethernet: [
      { address: "172.20.1.5", family: "IPv4", internal: false },
    ] }),
    "172.20.1.5",
  );
  assert.throws(() => choosePrivateIpv4({ Tailscale: [
    { address: "100.64.0.1", family: "IPv4", internal: false },
  ] }), /private Wi-Fi or Ethernet/);
});
