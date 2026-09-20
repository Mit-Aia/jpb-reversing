#define VERTEX_SHADER 1
attribute highp	vec4 a_position;
attribute lowp	vec4 a_color;
attribute highp	vec3 a_normal;
attribute highp	vec4 a_tangent;
attribute highp	vec2 a_uv0;
attribute highp	vec2 a_uv1;
attribute vec2	a_size;
attribute float	a_rotation;
attribute vec4	a_textureBlending;
attribute lowp	vec3 a_windCoeff;
attribute highp	vec4 a_instWorld0;
attribute highp	vec4 a_instWorld1;
attribute highp	vec4 a_instWorld2;
attribute highp	vec4 a_instWorld3;
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

struct Material { lowp vec3 diffuse; lowp vec4 specular; };
uniform Material u_material;

struct Light { mediump vec3 dir; mediump vec3 pos; mediump vec3 color; mediump float range; mediump vec2 hotspot; };
uniform Light u_light0;
uniform Light u_light1;

void main() {
	vec4 instPos = a_position;
	v_worldPos = vec3(u_modelMatrix * instPos);
	gl_Position = u_projMatrix * u_viewMatrix * vec4(v_worldPos, 1);
	vec3 viewPos = vec3(u_viewMatrix * vec4(v_worldPos, 1));
	vec3 worldNormal = normalize(mat3(u_modelMatrix) * a_normal);
	vec3 viewNormal = normalize(mat3(u_modelView) * a_normal);
	v_normal = worldNormal;
	v_color = a_color;
	v_uv0 = (u_uvMatrix0 * vec4(a_uv0, 0, 1)).xy;
}
