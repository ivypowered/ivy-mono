#!/usr/bin/env python3
import os
import shutil
import tempfile
import time
import sys
import argparse
from mkdocs.commands.build import build as mkdocs_build
from mkdocs.config import load_config
from bs4 import BeautifulSoup, Tag

def parse_args():
    parser = argparse.ArgumentParser(description='Build documentation from MkDocs and convert to Ivy format')
    parser.add_argument('--src-dir', required=True, help='Source directory for documentation')
    parser.add_argument('--dst-dir', required=True, help='Destination directory for processed files')
    parser.add_argument('--public-root', required=True, help='Public root URL path')
    parser.add_argument('--config-file', default=None, help='Path to mkdocs.yml config file (default: auto-detect)')
    return parser.parse_args()

def extract_navigation(name, soup, public_root):
    """Extract navigation items from MkDocs HTML."""
    nav_items = []
    navbar = soup.find('div', {'id': 'navbar-collapse'})
    if not navbar:
        return nav_items

    nav_list = navbar.find('ul', {'class': 'nav'})
    if not nav_list:
        return nav_items

    for link in nav_list.find_all('a', {'class': 'nav-link'}):
        href = link.get('href', '')
        title = str(link.text).strip().replace("_", " ")
        is_active = 'active' in link.get('class', [])

        # Determine URL based on href
        if href in ["..", ".", "./"]:
            url = public_root if href != "./" else f"{public_root}/{name}"
        elif href == "#":
            # search bar - this means we only have 1 page
            url = public_root
            title = "Home"
            is_active = True
        else:
            relative_link = href.replace('../', '').rstrip('/')
            url = public_root if not relative_link or relative_link == '.' else f"{public_root}/{relative_link.split('/')[-1]}"

        nav_items.append({
            'title': title,
            'url': url,
            'is_active': is_active
        })
    return nav_items

def find_prev_next_pages(nav_items, current_name):
    """Find previous and next pages based on current page name."""
    current_index = -1

    # Find the index of the current page
    for i, item in enumerate(nav_items):
        if item.get("is_active", False):
            current_index = i
            break

    prev_page = None
    next_page = None

    if current_index > 0:
        prev_page = nav_items[current_index - 1]

    if current_index < len(nav_items) - 1 and current_index != -1:
        next_page = nav_items[current_index + 1]

    return prev_page, next_page

def add_navigation_container(main_div, nav_items, current_name):
    """Add the navigation container at the end of the page."""
    prev_page, next_page = find_prev_next_pages(nav_items, current_name)

    # Start building the navigation container HTML as a string
    nav_html = '<div class="arrow-container">'

    # Add previous page link if it exists
    if prev_page:
        nav_html += f'''
        <div>
            <a href="{prev_page['url']}" class="arrow-link">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="butt"
                    stroke-linejoin="round"
                    class="h-5 w-5 mr-2"
                >
                    <path d="m12 19-7-7 7-7" />
                    <path d="M19 12H5" />
                </svg>
                {prev_page['title']}
            </a>
        </div>
        '''
    else:
        nav_html += '<div></div>'

    # Add next page link if it exists
    if next_page:
        nav_html += f'''
        <div>
            <a href="{next_page['url']}" class="arrow-link">
                {next_page['title']}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="butt"
                    stroke-linejoin="round"
                    class="h-5 w-5 ml-2"
                >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                </svg>
            </a>
        </div>
        '''
    else:
        nav_html += '<div></div>'

    # Close the container
    nav_html += '</div>'

    # Create the BeautifulSoup object once with the complete HTML
    nav_container = BeautifulSoup(nav_html, 'html.parser')

    # Append to main_div
    main_div.append(nav_container)
    return main_div

def convert_mkdocs_to_ivy(name, html_string, original_soup, public_root, tmp_dir, dst_dir):
    """Convert MkDocs HTML to Ivy-styled HTML with navigation."""
    soup = BeautifulSoup(html_string, 'html.parser')
    soup_div = soup.find("div")
    if not isinstance(soup_div, Tag):
        raise TypeError("soup_div is not Tag")
    nav_items = extract_navigation(name, original_soup, public_root)

    # Rewrite internal links
    site_prefix = public_root if public_root != "/" else ""

    for a_tag in soup_div.find_all('a', href=True):
        if not isinstance(a_tag, Tag):
            raise TypeError("a_tag is not Tag")
        current_classes = a_tag.get('class') or []
        if 'nav-link' in current_classes:
            continue

        href = str(a_tag['href'] or "")

        # Skip external links, mailto, tel, anchor links, or protocol-relative URLs
        if href.startswith(('http://', 'https://', 'mailto:', 'tel:', '#', '//')):
            continue

        if not href:
            continue

        new_href = href

        if href.startswith('/'):
            new_href = site_prefix + href
        elif href.startswith("../"):
            new_href = site_prefix + href[2:]
        else:
            new_href = site_prefix + "/" + href

        a_tag['href'] = new_href

    # Process image elements
    images_dir = os.path.join(dst_dir, 'images')

    for img_tag in soup_div.find_all('img', src=True):
        if not isinstance(img_tag, Tag):
            raise TypeError("img_tag is not Tag")

        src = str(img_tag['src'] or "")

        # Skip external images or data URLs
        if src.startswith(('http://', 'https://', 'data:', '//')):
            continue

        if not src:
            continue

        # Extract the filename (last component of the path)
        filename = os.path.basename(src)

        if not filename:
            continue

        # Look for the file in tmp_dir
        source_image_path = os.path.join(tmp_dir, filename)

        if os.path.exists(source_image_path):
            # Create images directory if it doesn't exist
            if not os.path.exists(images_dir):
                os.makedirs(images_dir)

            # Destination path for the image
            dest_image_path = os.path.join(images_dir, filename)

            # Copy the image if it doesn't already exist in the destination
            if not os.path.exists(dest_image_path):
                shutil.copy2(source_image_path, dest_image_path)

            # Update the src attribute
            new_src = f"{public_root}/images/{filename}" if public_root != "/" else f"/images/{filename}"
            img_tag['src'] = new_src

    # Create sidebar
    sidebar = BeautifulSoup('<div class="docs-nav"></div>', 'html.parser')
    nav_container = BeautifulSoup('''
    <div class="docs-nav-box">
        <div class="docs-nav-header">Navigation</div>
        <ul class="docs-nav-list"></ul>
    </div>
    ''', 'html.parser')

    nav_list = nav_container.find('ul')
    if not isinstance(nav_list, Tag):
        raise TypeError("nav_list must be Tag")
    for item in nav_items:
        li = BeautifulSoup(f'<li {"class=\"docs-nav-active\"" if item.get("is_active", False) else ""}></li>', 'html.parser').li
        a = BeautifulSoup(
            f'<a href="{item["url"]}" class="docs-nav-item">{item["title"]}</a>',
            'html.parser'
        ).a
        if not isinstance(li, Tag):
            raise TypeError("li must be Tag")
        if not isinstance(a, Tag):
            raise TypeError("a must be Tag")
        li.append(a)
        nav_list.append(li)

    sidebar_div = sidebar.find('div')
    if not isinstance(sidebar_div, Tag):
        raise TypeError("sidebar_div must be Tag")
    sidebar_div.append(nav_container)

    # Create container structure
    flex_container = BeautifulSoup('<div class="docs-root"></div>', 'html.parser')
    root_div = flex_container.find('div')
    if not isinstance(root_div, Tag):
        raise TypeError("root_div must be Tag")
    root_div.append(sidebar)

    # Create main content div with markdown class for styling
    main_div = BeautifulSoup('<div class="docs-content markdown"></div>', 'html.parser').div
    if not isinstance(main_div, Tag):
        raise TypeError("main_div must be Tag")

    # Create and add mobile nav dropdown at the top of the main content
    mobile_nav_html = '''
    <div class="docs-mobile-nav-container">
        <label for="mobile-nav-select" class="sr-only">Select Page</label>
        <select id="mobile-nav-select" class="docs-mobile-nav-select">
        </select>
        <div class="docs-mobile-nav-icon">
            <svg class="fill-current h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
        </div>
    </div>
    '''
    mobile_nav_container = BeautifulSoup(mobile_nav_html, 'html.parser')
    mobile_select = mobile_nav_container.find('select')

    if mobile_select and isinstance(mobile_select, Tag):
        for item in nav_items:
            option = BeautifulSoup(
                f'<option value="{item["url"]}" {" selected" if item.get("is_active", False) else ""}>{item["title"]}</option>',
                'html.parser'
            ).option
            if isinstance(option, Tag):
                mobile_select.append(option)

    # Add mobile nav to the top of the content container
    main_div.append(mobile_nav_container)

    # Patch + add soup div
    first_h1 = soup_div.find("h1")
    if not first_h1:
        print(html_string)
    if not isinstance(first_h1, Tag):
        raise TypeError("first_h1 not Tag")
    first_h1_class = first_h1.get("class", None)
    if isinstance(first_h1_class, list):
        first_h1_class.append("docs-desktop-header")
    else:
        first_h1["class"] = "docs-desktop-header"
    main_div.append(soup_div)

    # Add navigation container at the end of the main div
    add_navigation_container(main_div, nav_items, name)

    # Add JavaScript for mobile navigation
    script_html = '''
    <script>
        const mobileNavSelect = document.getElementById("mobile-nav-select");
        if (mobileNavSelect) {
            mobileNavSelect.addEventListener("change", function() {
                const selectedUrl = this.value;
                if (selectedUrl) {
                    window.location.href = selectedUrl;
                }
            });
        }
    </script>
    '''
    script_tag = BeautifulSoup(script_html, 'html.parser')
    main_div.append(script_tag)

    root_div.append(main_div)

    # Return flex container
    return str(flex_container)

def build_docs(args):
    start_time = time.monotonic()

    with tempfile.TemporaryDirectory() as tmp_dir:
        # Configure and run mkdocs build
        cfg = load_config(config_file=args.config_file)
        cfg.site_dir = tmp_dir
        cfg.use_directory_urls = True

        try:
            mkdocs_build(cfg, dirty=False)
        except Exception as e:
            print(f"Error during mkdocs build: {e}", file=sys.stderr)
            sys.exit(1)

        # Process the generated HTML files
        if os.path.exists(args.dst_dir):
            shutil.rmtree(args.dst_dir)
        os.makedirs(args.dst_dir)

        processed_files = 0
        for root, _, files in os.walk(args.src_dir):
            for file in files:
                if not file.endswith(".md"):
                    continue

                # Determine paths
                md_filepath = os.path.join(root, file)
                name = os.path.splitext(os.path.relpath(md_filepath, args.src_dir))[0]
                html_filepath = os.path.join(tmp_dir, "index.html" if name == "index" else f"{name}/index.html")

                if not os.path.exists(html_filepath):
                    print(f"Could not find HTML file: {html_filepath}", file=sys.stderr)
                    continue

                with open(html_filepath, "r", encoding="utf-8") as f:
                    html_content = f.read()

                original_soup = BeautifulSoup(html_content, "html.parser")
                main_content_div = original_soup.find("div", {"role": "main"})

                if not main_content_div:
                    print(f"No main content div in {html_filepath}", file=sys.stderr)
                    continue

                output_html = convert_mkdocs_to_ivy(name, str(main_content_div), original_soup, args.public_root, tmp_dir, args.dst_dir)
                output_filepath = os.path.join(args.dst_dir, f"{name}.html")

                # Create directory if needed
                os.makedirs(os.path.dirname(output_filepath), exist_ok=True)

                with open(output_filepath, "w", encoding="utf-8") as f:
                    f.write(output_html)
                processed_files += 1

    elapsed = time.monotonic() - start_time
    project_name = os.path.basename(os.getcwd())
    print(f"Built \033[1m{processed_files}\033[0m page{'s' if processed_files > 1 else ''} for \033[1m{project_name}\033[0m documentation in {elapsed:.2f} seconds", file=sys.stderr)

if __name__ == "__main__":
    args = parse_args()
    build_docs(args)
