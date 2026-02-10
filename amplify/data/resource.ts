import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { distance } from "three/tsl";

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/
const trackEnum = a.enum(["TURF", "DIRT", "JUMP"]);
const distanceEnum = a.enum([
  "1000",
  "1200",
  "1400",
  "1600",
  "1800",
  "2000",
  "2200",
  "2400",
  "2500",
  "3000",
  "3200",
]);

const schema = a.schema({
  Todo: a
    .model({
      content: a
        .string()
        .validate((v) =>
          v
            .minLength(1, "Content must be at least 1 character long")
            .maxLength(100, "Content must be less than 100 characters")
            .matches(
              "^[a-zA-Z0-9\\\\s]+$",
              "Content must contain only letters, numbers, and spaces",
            ),
        )
        .required(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Race: a
    .model({
      id: a.string().required(),
      name: a
        .string()
        .validate((v) =>
          v
            .minLength(1, "レース名を入力してください")
            .maxLength(100, "レース名は100文字以内で入力してください"),
        )
        .required(),
      track: trackEnum,
      distance: distanceEnum,
      location: a.string(),
      description: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
