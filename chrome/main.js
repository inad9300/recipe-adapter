/**
 * Main program.
 */
setup_elem_picker()
listen_and_propagate_input_changes()

/**
 * Let the user pick a DOM element and replace all the numbers on it with input boxes.
 */
function setup_elem_picker() {
    let last_hovered_elem

    const off_mouseover = on(document.body, 'mouseover', on_mouseover)
    const off_mouseout = on(document.body, 'mouseout', on_mouseout)
    const off_click = on(document.body, 'click', on_click)

    function on_mouseover(event) {
        last_hovered_elem = event.target
        add_bg(event.target)
    }

    function on_mouseout(event) {
        remove_bg(event.target)
    }

    function on_click(event) {
        remove_bg(last_hovered_elem)
        replace_quantities_with_inputs(last_hovered_elem)

        off_mouseover()
        off_mouseout()
        off_click()
    }

    function add_bg(elem) {
        elem.classList.add('ra-ingredient-list-selector')
    }

    function remove_bg(elem) {
        elem.classList.remove('ra-ingredient-list-selector')
    }

    /**
     * Replace all digits found within the given element with input boxes.
     */
    function replace_quantities_with_inputs(elem) {
        const qty_regexp = /([1-9]\d*)?\s*(½|⅓|⅔|¼|¾|⅕|⅖|⅗|⅘|⅙|⅚|⅐|⅛|⅜|⅝|⅞|⅑|⅒)|([1-9]\d*)?\s*[1-9]\d*\s*\/\s*[1-9]\d*|[1-9]\d*(\.\d+)?|\b[Hh]alf\b/g
        const walker = document.createTreeWalker(elem, NodeFilter.SHOW_TEXT)

        while (walker.nextNode()) {
            let match
            while ((match = qty_regexp.exec(walker.currentNode.nodeValue))) {
                const original_val = match[0]
                console.log('original_val', original_val)
                const val_str = get_parseable_val(original_val)
                const val_num = eval(val_str) // Only what fits the restricted regular expression is evaluated.
                if (isNaN(val_num) || !isFinite(val_num)) {
                    return
                }

                const span = document.createElement('span')
                span.classList.add('ra-ingredient-input')
                span.setAttribute('contenteditable', 'true')
                span.setAttribute('title', 'Original value: ' + original_val)
                span.setAttribute('data-initial-val', val_num)
                span.setAttribute('data-initial-val-was-fraction', val_str.indexOf('/') > -1)

                // Remove the original string and insert the new input box.
                const second_node = walker.currentNode.splitText(match.index)
                second_node.nodeValue = second_node.nodeValue.substr(match[0].length)
                walker.currentNode.parentNode.insertBefore(span, second_node)

                // Calculate the textual content only after the input is placed in the DOM.
                span.textContent = get_new_val_str(span, 1)

                // Skip the newly inserted input box.
                walker.nextNode()
            }
        }

        const ingredient_inputs = elem.getElementsByClassName('ra-ingredient-input')
        if (ingredient_inputs.length > 0) {
            ingredient_inputs[0].focus()
            select(ingredient_inputs[0])
        }

        /**
         * Replace non-numeric characters in the given string with their numeric counterparts.
         */
        function get_parseable_val(val_str) {
            // Add a plus sign to fractions in case there is a number in front of them, for later evaluation.
            return val_str
                .replace('½', '+1/2')
                .replace('⅓', '+1/3')
                .replace('⅔', '+2/3')
                .replace('¼', '+1/4')
                .replace('¾', '+3/4')
                .replace('⅕', '+1/5')
                .replace('⅖', '+2/5')
                .replace('⅗', '+3/5')
                .replace('⅘', '+4/5')
                .replace('⅙', '+1/6')
                .replace('⅚', '+5/6')
                .replace('⅐', '+1/7')
                .replace('⅛', '+1/8')
                .replace('⅜', '+3/8')
                .replace('⅝', '+5/8')
                .replace('⅞', '+7/8')
                .replace('⅑', '+1/9')
                .replace('⅒', '+1/10')
                .replace(/(\d+)\s+(\d+)\/(\d+)/g, '$1+$2/$3')
                .replace(/\s+/g, '')
                .replace(/[Hh]alf/, '1/2')
        }

        /**
         * Focus and select the contents of a DOM element.
         */
        function select(elem) {
            const range = document.createRange()
            range.selectNodeContents(elem)
            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
        }
    }
}

/**
 * Listen to changes on the input boxes and propagate them proportionally.
 */
function listen_and_propagate_input_changes() {
    on(document.body, 'keyup', event => {
        if (!event.target.classList.contains('ra-ingredient-input')) {
            return
        }

        const initial_val = get_initial_val(event.target)
        const current_val = str_to_num(event.target.textContent)
        const ratio = current_val / initial_val
        if (isNaN(ratio) || !isFinite(ratio)) {
            return
        }

        const ingredient_inputs = document.getElementsByClassName('ra-ingredient-input')

        for (const input of ingredient_inputs) {
            if (input !== event.target) {
                input.textContent = get_new_val_str(input, ratio)
            }
        }
    })

    /**
     * Convert from a string of the form "X/Y", "X.Y" or "XY" to a number.
     *
     * FIXME The user could copy/paste a fraction, or put a number, space and fraction. This should therefore get the same treatment as the original values.
     */
    function str_to_num(str) {
        const clean_str = str.replace(/[^\d]$/, '')
        return clean_str.indexOf('/') > -1
            ? fraction_to_float(clean_str)
            : parseFloat(clean_str)

        /**
         * Convert from a string of the form "X/Y" to the corresponding float number.
         */
        function fraction_to_float(str) {
            const [integer, fractional] = str.split('/')
            return parseInt(integer) / parseInt(fractional)
        }
    }
}

/**
 * Get a new value for the given input, in a readable form, considering its initial value and the conversion ratio.
 */
function get_new_val_str(input, ratio) {
    const initial_val = get_initial_val(input)
    const initial_val_was_fraction = input.getAttribute('data-initial-val-was-fraction') === 'true'
    const new_val = initial_val * ratio

    if (initial_val_was_fraction || contains_measuring_spoon(input.parentNode.textContent)) {
        const fr = get_nice_fraction(new_val)
        if (fr) {
            return fr
        }
    }

    const new_val_str = new_val.toFixed(1)
    return new_val_str.endsWith('.0')
        ? new_val_str.slice(0, -2)
        : new_val_str

    function contains_measuring_spoon(text) {
        const measuring_spoon_regexps = ['tablespoon', 'tbsp', 'cup', 'teaspoon', 'tsp'].map(spoon => {
            return new RegExp('\\b' + spoon + 's?\\b', 'gi')
        })

        for (const regexp of measuring_spoon_regexps) {
            if (regexp.test(text)) {
                return true
            }
        }
        return false
    }

    /**
     * Get a shorter representation of a fraction, if available and is reasonable.
     */
    function get_nice_fraction(num) {
        const sensible_fractions = {
            '½': 1 / 2,
            '⅓': 1 / 3,
            '⅔': 2 / 3,
            '¼': 1 / 4,
            '¾': 3 / 4,
            '⅕': 1 / 5,
            '⅖': 2 / 5,
            '⅒': 1 / 10
        }

        for (const fraction in sensible_fractions) {
            if (ish(num, sensible_fractions[fraction])) {
                return fraction
            }
        }

        /**
         * Check if two numbers are approximately the same, avoiding precission problems.
         */
        function ish(n, m) {
            return +n.toFixed(16) === +m.toFixed(16)
        }
    }
}

/**
 * Read back the numeric version of the original value.
 */
function get_initial_val(elem) {
    return parseFloat(elem.getAttribute('data-initial-val'))
}

/**
 * Shortcut for listening events on HTML elements.
 */
function on(elem, event, fn) {
    elem.addEventListener(event, fn)

    return function off() {
        elem.removeEventListener(event, fn)
    }
}
