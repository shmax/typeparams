import { TypeParams } from '../../src/type-params';

// Define the type for filters
type Filters = {
    filters: {
        toyline: number;
        tags?: Array<string>;
    };
};

// Create an instance of TypeParams with a query string
const params = new TypeParams<Filters>("?filters_toyline=3&filters_tags=foo|bar");
// Accessing individual parameters
const toyline = params.get("filters.toyline");

// Modify parameters dynamically with a string path
params.set("filters.toyline", 5);

// or with an object (note that this is equivalent to the line above in that will deep merge atop existing values by default, but you can pass false
// to the second param if you want to wipe existing data)
params.set({filters: {toyline: 6}});

// Create HTML output
function createOutput() {
    const app = document.getElementById('app') || document.body;

    const section = (title: string, content: string) => `
        <section>
            <h2>${title}</h2>
            <pre>${content}</pre>
        </section>
    `;

    app.innerHTML = `
        <h1>TypeParams Demo</h1>
        ${section("Initial Parsed Parameters", JSON.stringify({
        toyline,
    }, null, 2))}
        ${section("Updated Parameters", JSON.stringify(params.all(), null, 2))}
        ${section("Serialized Query String", params.toString())}
    `;
}

// Generate the output when the page loads
createOutput();
