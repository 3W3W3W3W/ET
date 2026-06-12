export const information = {
  name: "information",
  title: "Information",
  type: "document",
  fields: [
    {
      name: "body",
      title: "Body",
      type: "array",
      of: [{ type: "block" }],
    },
  ],
  preview: {
    prepare: () => ({ title: "Information" }),
  },
};
