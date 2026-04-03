#!/usr/bin/env node

/**
 * Build Script - Template Processor
 * Reads templates from /src/templates/ and injects components
 * Outputs production HTML files to root directory
 */

const fs = require('fs');
const path = require('path');

// Define the mapping of templates to output files
const templateMappings = [
    { template: 'index.html.template', output: 'index.html' },
    { template: 'news.html.template', output: 'news.html' },
    { template: 'partnerships.html.template', output: 'partnerships.html' },
    { template: 'data.html.template', output: 'data.html' },
    { template: '404.html.template', output: '404.html' },
    { template: 'article.html.template', output: null, multiFile: [
        { input: 'articles/hemp-ban-2026.html.template', output: 'articles/hemp-ban-2026.html' },
        { input: 'articles/texas-cannabis-legalization-march-2026.html.template', output: 'articles/texas-cannabis-legalization-march-2026.html' },
    ]},
    { template: 'education.html.template', output: null, multiFile: [
        { input: 'education/edibles-101-start-low-go-slow-desert-survival-guide.html.template', output: 'education/edibles-101-start-low-go-slow-desert-survival-guide.html' },
        { input: 'education/vapes-dabs-flower-perfect-consumption-method.html.template', output: 'education/vapes-dabs-flower-perfect-consumption-method.html' },
        { input: 'education/decoding-dispensary-menu-eighth-shake-live-resin-guide.html.template', output: 'education/decoding-dispensary-menu-eighth-shake-live-resin-guide.html' },
    ]},
];

// Read component files
function readComponent(componentPath) {
    try {
        return fs.readFileSync(componentPath, 'utf-8');
    } catch (e) {
        console.error(`Failed to read component: ${componentPath}`);
        process.exit(1);
    }
}

// Read template file
function readTemplate(templatePath) {
    try {
        return fs.readFileSync(templatePath, 'utf-8');
    } catch (e) {
        console.error(`Failed to read template: ${templatePath}`);
        return null;
    }
}

// Process template and inject components
function processTemplate(templateContent) {
    const header = readComponent(path.join(__dirname, 'src/components/header.html'));
    const footer = readComponent(path.join(__dirname, 'src/components/footer.html'));
    const mobileNav = readComponent(path.join(__dirname, 'src/components/mobile-nav.html'));
    const sharedStyles = readComponent(path.join(__dirname, 'src/assets/shared-styles.css'));
    const mobileNavJs = readComponent(path.join(__dirname, 'src/assets/mobile-nav.js'));

    let output = templateContent;

    // Replace placeholders
    output = output.replace(/{{HEADER}}/g, header);
    output = output.replace(/{{FOOTER}}/g, footer);
    output = output.replace(/{{MOBILE_NAV}}/g, mobileNav);
    output = output.replace(/{{SHARED_STYLES}}/g, `<style>\n${sharedStyles}\n</style>`);
    output = output.replace(/{{MOBILE_NAV_JS}}/g, `<script>\n${mobileNavJs}\n</script>`);

    return output;
}

// Write output file
function writeOutput(outputPath, content) {
    const dir = path.dirname(outputPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`✓ Built: ${outputPath}`);
}

// Main build process
function build() {
    console.log('🔨 Starting build process...\n');

    const srcPath = path.join(__dirname, 'src/templates');
    let filesBuilt = 0;

    for (const mapping of templateMappings) {
        if (mapping.multiFile) {
            // Handle multi-file templates (articles, education)
            for (const fileMapping of mapping.multiFile) {
                const templatePath = path.join(srcPath, fileMapping.input);
                const templateContent = readTemplate(templatePath);

                if (templateContent) {
                    const processed = processTemplate(templateContent);
                    const outputPath = path.join(__dirname, fileMapping.output);
                    writeOutput(outputPath, processed);
                    filesBuilt++;
                }
            }
        } else {
            // Handle single-file templates
            const templatePath = path.join(srcPath, mapping.template);
            const templateContent = readTemplate(templatePath);

            if (templateContent) {
                const processed = processTemplate(templateContent);
                const outputPath = path.join(__dirname, mapping.output);
                writeOutput(outputPath, processed);
                filesBuilt++;
            }
        }
    }

    console.log(`\n✅ Build complete! Built ${filesBuilt} files.`);
}

// Run build
build();
