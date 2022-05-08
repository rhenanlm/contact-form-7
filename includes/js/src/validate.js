import { setStatus } from './status';
import * as validators from './swv/rules';
import FormDataTree from './swv/form-data-tree';


export default function validate( form, options = {} ) {
	const scope = form;
	const targetFields = [];

	for ( const wrap of scope.querySelectorAll( '.wpcf7-form-control-wrap' ) ) {
		if ( wrap.dataset.name ) {
			targetFields.push( wrap.dataset.name );

			if (
				options.target &&
				wrap.dataset.name === options.target.name.replace( /\[.*\]$/, '' )
			) {
				break;
			}
		}
	}

	const validators = validate.validators ?? {};

	const rules = ( form.wpcf7.schema.rules ?? [] ).filter(
		( { rule, ...properties } ) => {

			if ( 'function' === typeof validators[rule]?.matches ) {
				return validators[rule].matches( properties, options );
			}

			return targetFields.includes( properties.field );
		}
	);

	if ( ! rules.length ) {
		return;
	}

	const prevStatus = form.getAttribute( 'data-status' );

	Promise.resolve( setStatus( form, 'validating' ) )
		.then( status => {
			const invalidFields = [];
			const formDataTree = new FormDataTree( form );

			for ( const { rule, ...properties } of rules ) {
				if ( invalidFields.includes( properties.field ) ) {
					continue;
				}

				if ( 'function' === typeof validators[rule] ) {
					try {
						removeValidationError( form, properties.field );
						validators[rule].call( { rule, ...properties }, formDataTree );
					} catch ( error ) {
						setValidationError( form, properties.field, error.error );
						invalidFields.push( properties.field );
					}
				}
			}
		} )
		.finally( () => {
			setStatus( form, prevStatus );
		} );
}

validate.validators = validators;


export const setValidationError = ( form, fieldName, message ) => {
	const errorId = `${ form.wpcf7?.unitTag }-ve-${ fieldName }`;

	const firstFoundControl = form.querySelector(
		`.wpcf7-form-control-wrap[data-name="${ fieldName }"] .wpcf7-form-control`
	);

	const setScreenReaderValidationError = () => {
		const li = document.createElement( 'li' );

		li.setAttribute( 'id', errorId );

		if ( firstFoundControl && firstFoundControl.id ) {
			li.insertAdjacentHTML(
				'beforeend',
				`<a href="#${ firstFoundControl.id }">${ message }</a>`
			);
		} else {
			li.insertAdjacentText(
				'beforeend',
				message
			);
		}

		form.wpcf7.parent.querySelector(
			'.screen-reader-response ul'
		).appendChild( li );
	};

	const setVisualValidationError = () => {
		form.querySelectorAll(
			`.wpcf7-form-control-wrap[data-name="${ fieldName }"]`
		).forEach( wrap => {
			const tip = document.createElement( 'span' );
			tip.classList.add( 'wpcf7-not-valid-tip' );
			tip.setAttribute( 'aria-hidden', 'true' );
			tip.insertAdjacentText( 'beforeend', message );
			wrap.appendChild( tip );

			wrap.querySelectorAll( '[aria-invalid]' ).forEach( elm => {
				elm.setAttribute( 'aria-invalid', 'true' );
			} );

			wrap.querySelectorAll( '.wpcf7-form-control' ).forEach( control => {
				control.classList.add( 'wpcf7-not-valid' );
				control.setAttribute( 'aria-describedby', errorId );

				if ( typeof control.setCustomValidity === 'function' ) {
					control.setCustomValidity( message );
				}

				if ( control.closest( '.use-floating-validation-tip' ) ) {
					control.addEventListener( 'focus', event => {
						tip.setAttribute( 'style', 'display: none' );
					} );

					tip.addEventListener( 'click', event => {
						tip.setAttribute( 'style', 'display: none' );
					} );
				}
			} );
		} );
	};

	setScreenReaderValidationError();
	setVisualValidationError();
};


export const removeValidationError = ( form, fieldName ) => {
	const errorId = `${ form.wpcf7?.unitTag }-ve-${ fieldName }`;

	form.wpcf7.parent.querySelector(
		`.screen-reader-response ul li#${ errorId }`
	)?.remove();

	form.querySelectorAll(
		`.wpcf7-form-control-wrap[data-name="${ fieldName }"]`
	).forEach( wrap => {
		wrap.querySelector( '.wpcf7-not-valid-tip' )?.remove();

		wrap.querySelectorAll( '[aria-invalid]' ).forEach( elm => {
			elm.setAttribute( 'aria-invalid', 'false' );
		} );

		wrap.querySelectorAll( '.wpcf7-form-control' ).forEach( control => {
			control.removeAttribute( 'aria-describedby' );
			control.classList.remove( 'wpcf7-not-valid' );

			if ( typeof control.setCustomValidity === 'function' ) {
				control.setCustomValidity( '' );
			}
		} );
	} );
};
