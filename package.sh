#!/bin/bash

# Package script for paw extension
# Creates Chrome and Firefox packages for store submission

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EXTENSION_NAME="paw"
VERSION=$(grep '"version"' manifest.json | cut -d'"' -f4)
CHROME_PACKAGE="${EXTENSION_NAME}-chrome-${VERSION}.zip"
FIREFOX_PACKAGE="${EXTENSION_NAME}-firefox-${VERSION}.zip"
OUTPUT_DIR="web-ext-artifacts"

echo -e "${BLUE}Packaging ${EXTENSION_NAME} v${VERSION}${NC}"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to create Chrome package
package_chrome() {
    echo -e "${YELLOW}Creating Chrome package...${NC}"
    
    # Create temporary directory for Chrome package
    TEMP_DIR=$(mktemp -d)
    cp -r . "$TEMP_DIR/"
    cd "$TEMP_DIR"
    
    # Remove Firefox-specific files and directories
    rm -f manifest-v2.json manifest-v3.json
    rm -f package.sh
    rm -rf .git
    rm -f .DS_Store
    rm -rf web-ext-artifacts
    
    # Create Chrome package
    zip -r "$CHROME_PACKAGE" . -x "*.git*" "*.DS_Store*" "web-ext-artifacts/*" "package.sh" "manifest-v*.json"
    
    # Move package to output directory
    mv "$CHROME_PACKAGE" "$OLDPWD/$OUTPUT_DIR/"
    
    # Cleanup
    cd "$OLDPWD"
    rm -rf "$TEMP_DIR"
    
    echo -e "${GREEN}Chrome package created: $OUTPUT_DIR/$CHROME_PACKAGE${NC}"
}

# Function to create Firefox package
package_firefox() {
    echo -e "${YELLOW}Creating Firefox package...${NC}"
    
    # Check if web-ext is installed
    if ! command -v web-ext &> /dev/null; then
        echo -e "${RED}web-ext is not installed. Installing...${NC}"
        npm install -g web-ext
    fi
    
    # Create Firefox-compatible manifest
    cp manifest-v2.json manifest.json
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" manifest.json
    rm -f manifest.json.bak
    
    # Create Firefox package using web-ext
    web-ext build --source-dir . --artifacts-dir "$OUTPUT_DIR" --filename "$FIREFOX_PACKAGE"
    
    # Restore original manifest.json
    git checkout manifest.json 2>/dev/null || cp manifest-v3.json manifest.json
    
    echo -e "${GREEN}Firefox package created: $OUTPUT_DIR/$FIREFOX_PACKAGE${NC}"
}

# Function to validate packages
validate_packages() {
    echo -e "${YELLOW}Validating packages...${NC}"
    
    # Check Chrome package
    if [ -f "$OUTPUT_DIR/$CHROME_PACKAGE" ]; then
        echo -e "${GREEN}✓ Chrome package exists: $CHROME_PACKAGE${NC}"
        unzip -l "$OUTPUT_DIR/$CHROME_PACKAGE" | grep -q "manifest.json" && echo -e "${GREEN}✓ Chrome manifest.json found${NC}" || echo -e "${RED}✗ Chrome manifest.json missing${NC}"
    else
        echo -e "${RED}✗ Chrome package not found${NC}"
    fi
    
    # Check Firefox package
    if [ -f "$OUTPUT_DIR/$FIREFOX_PACKAGE" ]; then
        echo -e "${GREEN}✓ Firefox package exists: $FIREFOX_PACKAGE${NC}"
        unzip -l "$OUTPUT_DIR/$FIREFOX_PACKAGE" | grep -q "manifest.json" && echo -e "${GREEN}✓ Firefox manifest.json found${NC}" || echo -e "${RED}✗ Firefox manifest.json missing${NC}"
    else
        echo -e "${RED}✗ Firefox package not found${NC}"
    fi
}

# Function to show package info
show_package_info() {
    echo -e "${BLUE}Package Information:${NC}"
    echo -e "Extension: ${EXTENSION_NAME}"
    echo -e "Version: ${VERSION}"
    echo -e "Chrome Package: ${CHROME_PACKAGE}"
    echo -e "Firefox Package: ${FIREFOX_PACKAGE}"
    echo -e "Output Directory: ${OUTPUT_DIR}"
    echo ""
}

# Function to show store submission instructions
show_submission_instructions() {
    echo -e "${BLUE}Store Submission Instructions:${NC}"
    echo ""
    echo -e "${YELLOW}Chrome Web Store:${NC}"
    echo "1. Go to https://chrome.google.com/webstore/devconsole/"
    echo "2. Upload: $OUTPUT_DIR/$CHROME_PACKAGE"
    echo "3. Fill in store listing details"
    echo "4. Submit for review"
    echo ""
    echo -e "${YELLOW}Firefox Add-ons:${NC}"
    echo "1. Go to https://addons.mozilla.org/developers/"
    echo "2. Upload: $OUTPUT_DIR/$FIREFOX_PACKAGE"
    echo "3. Fill in store listing details"
    echo "4. Submit for review"
    echo ""
}

# Main execution
main() {
    show_package_info
    
    # Create packages
    package_chrome
    package_firefox
    
    # Validate packages
    validate_packages
    
    # Show submission instructions
    show_submission_instructions
    
    echo -e "${GREEN}Packaging complete!${NC}"
    echo -e "Packages are ready in: ${OUTPUT_DIR}/"
}

# Check if we're in the right directory
if [ ! -f "manifest.json" ]; then
    echo -e "${RED}Error: manifest.json not found. Please run this script from the extension root directory.${NC}"
    exit 1
fi

# Run main function
main "$@"
