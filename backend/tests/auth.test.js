const request = require("supertest");

const mockUserSave = jest.fn();
const mockUserFindOne = jest.fn();

jest.mock("../src/models/User", () => {
  const User = jest.fn().mockImplementation((data) => ({
    ...data,
    save: mockUserSave
  }));

  User.findOne = mockUserFindOne;

  return User;
});

const app = require("../src/app");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/auth/signup", () => {
  it("creates a new account", async () => {
    mockUserFindOne.mockResolvedValueOnce(null);
    mockUserSave.mockResolvedValueOnce({
      _id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      password: "hashed-password",
      phone: "1234567890",
      role: "patient"
    });

    const response = await request(app).post("/api/auth/signup").send({
      name: "Alice",
      email: "alice@example.com",
      password: "supersecret",
      phone: "1234567890",
      role: "patient"
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe("alice@example.com");
    expect(response.body.token).toBeDefined();
  });
});

describe("POST /api/auth/login", () => {
  it("authenticates an existing user", async () => {
    mockUserFindOne.mockResolvedValueOnce({
      _id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      password: "hashed-password",
      phone: "1234567890",
      role: "patient",
      comparePassword: jest.fn().mockResolvedValue(true)
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "alice@example.com",
      password: "supersecret"
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe("alice@example.com");
    expect(response.body.token).toBeDefined();
  });
});
