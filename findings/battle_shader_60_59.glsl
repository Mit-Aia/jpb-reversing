#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec3 v_normal;
varying vec3 v_worldPos;
varying vec3 v_viewDir;
varying vec3 v_viewPos;
varying vec3 v_tangent;
varying vec3 v_bitangent;
varying lowp vec4 v_color;
varying vec2 v_uv0;

uniform highp	mat4 u_modelMatrix;
uniform highp	mat4 u_viewMatrix;
uniform highp	mat4 u_projMatrix;
uniform highp	mat4 u_modelView;
uniform highp	mat4 u_modelViewProj;
uniform highp	vec3 WorldCamPos;
uniform lowp	vec4 u_globalColor;
uniform lowp	vec3 u_ambientColor;
uniform highp	mat4 u_uvMatrix0;
uniform highp	mat4 u_uvMatrix1;
uniform highp	mat4 u_uvMatrix2;
uniform highp	mat4 u_uvMatrix3;
uniform lowp	vec4 u_texAmount;

uniform sampler2D Texture0;

struct Material { lowp vec3 diffuse; lowp vec4 specular; };
uniform Material u_material;

struct Light { mediump vec3 dir; mediump vec3 pos; mediump vec3 color; mediump float range; mediump vec2 hotspot; };
uniform Light u_light0;
uniform Light u_light1;

float unpackFloat(vec4 value) {
	const vec4 bitShift = vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 160581375.0);
	return dot(value, bitShift);
}
vec4 packFloat(float value) {
	const vec4 bitShift = vec4(1.0, 255.0, 65025.0, 160581375.0);
	vec4 result = bitShift * value;
	result = fract(result);
	result -= result.yzww * (1.0 / 255.0);
	return result;
}
void main() {
	lowp vec4 fragColor = vec4(1.0);
	lowp vec4 lightDiff = vec4(0.0);
	lowp vec3 lightSpec = vec3(0.0);
	lowp vec4 specularColor = u_material.specular;
	lowp vec4 prebump = vec4(1.0);
	vec3 fragNormal = v_normal;
	{ //sampler0
	fragColor *= (u_texAmount[0] * texture2D(Texture0, v_uv0));
	}
	fragColor *= v_color;
	mediump float glossiness = specularColor.a * 128.0;
	{ //light0
	vec3 lightDir = u_light0.dir;
	float atten = 1.0;
	float diff = max(dot(lightDir, fragNormal), 0.0) * atten;
	lightDiff.xyz += u_light0.color * diff;
	}
	{ //light1
	vec3 lightDir = u_light1.dir;
	float atten = 1.0;
	float diff = max(dot(lightDir, fragNormal), 0.0) * atten;
	lightDiff.xyz += u_light1.color * diff;
	}
	lightDiff.xyz += u_ambientColor.xyz;
	fragColor.xyz *= lightDiff.xyz * u_material.diffuse.xyz;
	fragColor.xyz += lightSpec.xyz * specularColor.xyz;
	fragColor *= u_globalColor;
	gl_FragColor = fragColor;
}
