const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require('uuid');

const deploymentsPath = path.join(__dirname, "../../deployments");

exports.createDeployment = (data) => {

    const id = uuidv4();

    data.id = id;
    data.updatedAt = new Date().toISOString();

    // make folder name readable
    const safeName = (data.name || "deployment")
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');

    const folder = path.join(deploymentsPath, `${safeName}-${id}`);

    fs.mkdirSync(folder, { recursive: true });

    fs.writeFileSync(
        path.join(folder, "metadata.json"),
        JSON.stringify(data, null, 2)
    );

    return { id };
};

exports.getDeployments = () => {

    if (!fs.existsSync(deploymentsPath)) {
        return [];
    }

    const folders = fs.readdirSync(deploymentsPath);

    return folders.map(folder => {

        const metadataPath = path.join(
            deploymentsPath,
            folder,
            "metadata.json"
        );

        if (fs.existsSync(metadataPath)) {
            return JSON.parse(
                fs.readFileSync(metadataPath)
            );
        }

    }).filter(Boolean);

};

exports.updateStatus = (id, payload) => {
    const { status, url } = payload || {};

    const folders = fs.readdirSync(deploymentsPath);

    folders.forEach(folder => {
        const metadataPath = path.join(deploymentsPath, folder, "metadata.json");

        if (fs.existsSync(metadataPath)) {
            const data = JSON.parse(fs.readFileSync(metadataPath));

            if (data.id === id) {
                if (status) data.status = status;
                if (typeof url !== 'undefined') data.url = url; // allow null too
                const normalizedStatus = (status || '').toLowerCase();
                if (['deployed', 'completed', 'active'].includes(normalizedStatus)) {
                    data.deployedAt = new Date().toISOString();
                }
                data.updatedAt = new Date().toISOString();

                fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2));
            }
        }
    });
};